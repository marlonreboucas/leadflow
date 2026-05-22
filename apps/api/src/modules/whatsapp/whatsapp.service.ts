import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EvolutionClient } from '../../integrations/evolution/evolution.client';
import {
  mapEvolutionConnectionStatus,
  phoneFromOwnerJid,
} from '../../integrations/evolution/evolution.connection';
import { extractQrBase64 } from '../../integrations/evolution/evolution.qr';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCKET_EVENTS } from '@leadflow/shared';
import { env } from '../../config/env';
import { UsageLimiterService } from '../billing/usage-limiter.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
    private readonly realtime: RealtimeGateway,
    private readonly limits: UsageLimiterService,
  ) {}

  async listInstances(companyId: string) {
    const instances = await this.prisma.whatsappInstance.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    await Promise.all(
      instances.map((inst) => this.syncConnectionFromEvolution(companyId, inst.id)),
    );
    return this.prisma.whatsappInstance.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Atualiza status no banco consultando a Evolution (webhook pode não alcançar a API no host). */
  async syncConnectionFromEvolution(companyId: string, instanceId: string) {
    const instance = await this.getInstance(companyId, instanceId);
    try {
      const row = await this.evolution.fetchInstanceRow(instance.externalName);
      if (!row) return instance;
      const r = row as Record<string, unknown>;
      const status = mapEvolutionConnectionStatus(
        (r.connectionStatus as string) ?? (r.state as string),
      );
      const phone =
        phoneFromOwnerJid(r.ownerJid as string) ??
        (r.number ? String(r.number).replace(/\D/g, '') : undefined);
      const changed =
        status !== instance.status ||
        (phone && phone !== instance.phoneNumber) ||
        (status === 'CONNECTED' && instance.qrCode);

      if (!changed) {
        if (status === 'CONNECTED') await this.ensureWebhookRegistered(instance);
        return instance;
      }

      const updated = await this.updateStatus(instanceId, companyId, status, {
        phoneNumber: phone ?? instance.phoneNumber ?? undefined,
        qrCode: status === 'CONNECTED' ? null : instance.qrCode,
      });
      if (status === 'CONNECTED') await this.ensureWebhookRegistered(updated);
      return updated;
    } catch (err) {
      this.evolution.logError('syncConnection', err);
      return instance;
    }
  }

  private buildWebhookUrl(webhookToken: string) {
    return `${env.WEBHOOK_PUBLIC_URL.replace(/\/$/, '')}/webhooks/evolution/${webhookToken}`;
  }

  /** Normaliza URL salva na Evolution (pode incluir sufixo /messages-upsert com webhookByEvents). */
  private normalizeWebhookUrl(url?: string | null) {
    if (!url) return '';
    return url.replace(/\/(messages-upsert|messages-update|connection-update|qrcode-updated)\/?$/i, '');
  }

  /** Re-registra webhook na Evolution (ex.: após trocar WEBHOOK_PUBLIC_URL no .env). */
  async ensureWebhookRegistered(instance: { externalName: string; webhookToken: string }) {
    const expected = this.buildWebhookUrl(instance.webhookToken);
    try {
      const current = await this.evolution.findWebhook(instance.externalName);
      const currentBase = this.normalizeWebhookUrl(current?.url);
      const urlOk = currentBase === expected;
      const eventsOk = current?.webhookByEvents === false;
      const localhostLeak =
        currentBase.includes('localhost') && expected.includes('host.docker.internal');
      if (urlOk && current?.enabled && eventsOk && !localhostLeak) {
        return { url: expected, updated: false };
      }
      await this.evolution.setWebhook(instance.externalName, expected);
      this.logger.log(`Webhook Evolution atualizado: ${expected}`);
      return { url: expected, updated: true };
    } catch (err) {
      this.evolution.logError('ensureWebhook', err);
      throw new BadRequestException(
        `Não foi possível atualizar webhook na Evolution. URL esperada: ${expected}`,
      );
    }
  }

  async getInstance(companyId: string, id: string) {
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { id, companyId },
    });
    if (!instance) throw new NotFoundException('Instância não encontrada');
    return instance;
  }

  async createInstance(companyId: string) {
    await this.limits.assertCanCreateInstance(companyId);

    const webhookToken = randomUUID();
    const externalName = `lf-${companyId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    const webhookUrl = `${env.WEBHOOK_PUBLIC_URL.replace(/\/$/, '')}/webhooks/evolution/${webhookToken}`;

    let qrCode: string | null = null;
    let pairingCode: string | null = null;
    try {
      const created = await this.evolution.createInstance(externalName, webhookUrl);
      qrCode = (created as { base64?: string }).base64 ?? extractQrBase64(created);
      pairingCode = (created as { pairingCode?: string }).pairingCode ?? null;
      if (!qrCode) {
        const polled = await this.evolution.fetchQr(externalName);
        qrCode =
          (polled as { base64?: string }).base64 ??
          (polled as { qrCode?: string }).qrCode ??
          extractQrBase64(polled);
        pairingCode = (polled as { pairingCode?: string }).pairingCode ?? pairingCode;
      }
    } catch (err) {
      this.evolution.logError('createInstance', err);
      throw new BadRequestException(
        'Evolution API indisponível. Verifique `pnpm docker:up` e EVOLUTION_API_KEY no .env.',
      );
    }

    const instance = await this.prisma.whatsappInstance.create({
      data: {
        companyId,
        externalName,
        webhookToken,
        status: 'CONNECTING',
        qrCode,
        settings: pairingCode
          ? ({ pairingCode } as Prisma.InputJsonValue)
          : undefined,
      },
    });

    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.WHATSAPP_STATUS_UPDATED, {
      instanceId: instance.id,
      status: instance.status,
    });

    return instance;
  }

  async getQr(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    await this.syncConnectionFromEvolution(companyId, id);
    const synced = await this.getInstance(companyId, id);
    if (synced.status === 'CONNECTED') {
      return {
        qrCode: null,
        pairingCode: undefined,
        managerUrl: this.evolution.managerUrl(),
        hint: 'WhatsApp já conectado.',
      };
    }
    try {
      const raw = await this.evolution.fetchQr(instance.externalName);
      const qrCode =
        (raw as { base64?: string }).base64 ??
        (raw as { qrCode?: string }).qrCode ??
        extractQrBase64(raw);
      const pairingCode = (raw as { pairingCode?: string }).pairingCode;

      if (qrCode || pairingCode) {
        const updated = await this.prisma.whatsappInstance.update({
          where: { id },
          data: {
            qrCode: qrCode ?? instance.qrCode,
            status: 'CONNECTING',
            settings: pairingCode
              ? { ...(instance.settings as object), pairingCode }
              : instance.settings ?? undefined,
          },
        });
        this.realtime.emitToCompany(companyId, SOCKET_EVENTS.WHATSAPP_STATUS_UPDATED, {
          instanceId: id,
          qrCode: updated.qrCode,
          status: updated.status,
        });
        return {
          qrCode: updated.qrCode,
          pairingCode,
          managerUrl: this.evolution.managerUrl(),
        };
      }
    } catch (err) {
      this.evolution.logError('fetchQr', err);
    }
    return {
      qrCode: instance.qrCode,
      pairingCode: (instance.settings as { pairingCode?: string })?.pairingCode,
      managerUrl: this.evolution.managerUrl(),
      hint:
        instance.qrCode
          ? undefined
          : 'Evolution retornou sem QR. Atualize a imagem Docker (ver README) ou abra o Manager.',
    };
  }

  async refreshWebhook(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    return this.ensureWebhookRegistered(instance);
  }

  async restartInstance(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    try {
      await this.evolution.connectInstance(instance.externalName);
    } catch (err) {
      this.evolution.logError('connectInstance', err);
    }
    return this.getQr(companyId, id);
  }

  async deleteInstance(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    try {
      await this.evolution.deleteInstance(instance.externalName);
    } catch (err) {
      this.evolution.logError('deleteInstance', err);
    }
    await this.prisma.whatsappInstance.delete({ where: { id } });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.WHATSAPP_STATUS_UPDATED, {
      instanceId: id,
      deleted: true,
    });
    return { ok: true };
  }

  async findByWebhookToken(token: string) {
    return this.prisma.whatsappInstance.findUnique({
      where: { webhookToken: token },
      include: { company: true },
    });
  }

  async updateStatus(
    instanceId: string,
    companyId: string,
    status: 'PENDING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED',
    extra?: { qrCode?: string | null; phoneNumber?: string },
  ) {
    const updated = await this.prisma.whatsappInstance.update({
      where: { id: instanceId },
      data: {
        status,
        ...(extra?.qrCode !== undefined ? { qrCode: extra.qrCode } : {}),
        ...(extra?.phoneNumber !== undefined ? { phoneNumber: extra.phoneNumber } : {}),
        lastConnectedAt: status === 'CONNECTED' ? new Date() : undefined,
      },
    });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.WHATSAPP_STATUS_UPDATED, {
      instanceId,
      status: updated.status,
      phoneNumber: updated.phoneNumber,
      qrCode: updated.qrCode,
    });
    return updated;
  }
}
