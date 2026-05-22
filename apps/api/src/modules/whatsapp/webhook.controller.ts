import { Body, Controller, Param, Post, NotFoundException, Logger } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';
import { QueuesService } from '../../queues/queues.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, SOCKET_EVENTS } from '@leadflow/shared';
import type { EvolutionWebhookPayload } from '../../integrations/evolution/evolution.types';

@Public()
@Controller('webhooks/evolution')
export class EvolutionWebhookController {
  private readonly logger = new Logger(EvolutionWebhookController.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly queues: QueuesService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Evolution com webhookByEvents=false */
  @Post(':token')
  async handleBase(@Param('token') token: string, @Body() payload: EvolutionWebhookPayload) {
    return this.process(token, undefined, payload);
  }

  /** Evolution com webhookByEvents=true → .../messages-upsert */
  @Post(':token/:eventPath')
  async handleWithPath(
    @Param('token') token: string,
    @Param('eventPath') eventPath: string,
    @Body() payload: EvolutionWebhookPayload,
  ) {
    return this.process(token, eventPath, payload);
  }

  private async process(
    token: string,
    eventPath: string | undefined,
    payload: EvolutionWebhookPayload,
  ) {
    const instance = await this.whatsapp.findByWebhookToken(token);
    if (!instance) throw new NotFoundException();

    const pathEvent = eventPath?.replace(/-/g, '.').toLowerCase() ?? '';
    const bodyEvent = payload.event?.toLowerCase?.() ?? '';
    const event = bodyEvent || pathEvent;

    this.logger.log(`Webhook ${instance.externalName} event=${event || 'unknown'}`);

    await this.prisma.webhookLog.create({
      data: {
        companyId: instance.companyId,
        direction: 'INBOUND',
        source: 'evolution',
        endpoint: eventPath
          ? `/webhooks/evolution/${token}/${eventPath}`
          : `/webhooks/evolution/${token}`,
        status: 200,
        payload: payload as object,
      },
    });

    if (
      event.includes('messages.upsert') ||
      event === 'messages_upsert' ||
      pathEvent.includes('messages.upsert')
    ) {
      await this.queues.add(QUEUES.INCOMING_MESSAGE, {
        companyId: instance.companyId,
        instanceId: instance.id,
        externalName: instance.externalName,
        payload,
      });
    } else if (event.includes('connection.update') || event === 'connection_update') {
      const state = extractConnectionState(payload);
      const status =
        state === 'open'
          ? 'CONNECTED'
          : state === 'close'
            ? 'DISCONNECTED'
            : state === 'connecting'
              ? 'CONNECTING'
              : 'PENDING';
      await this.whatsapp.updateStatus(instance.id, instance.companyId, status, {
        qrCode: status === 'CONNECTED' ? null : undefined,
      });
    } else if (event.includes('qrcode') || event === 'qrcode_updated') {
      const qr = extractQr(payload);
      if (qr) {
        await this.whatsapp.updateStatus(instance.id, instance.companyId, 'PENDING', {
          qrCode: qr,
        });
      }
      this.realtime.emitToCompany(instance.companyId, SOCKET_EVENTS.WHATSAPP_STATUS_UPDATED, {
        instanceId: instance.id,
        qrCode: qr,
      });
    }

    return { ok: true };
  }
}

function extractConnectionState(payload: EvolutionWebhookPayload): string | undefined {
  const data = payload.data as Record<string, unknown> | undefined;
  return (
    (data?.state as string) ??
    (data?.status as string) ??
    (payload as { state?: string }).state
  )?.toLowerCase();
}

function extractQr(payload: EvolutionWebhookPayload): string | undefined {
  const data = payload.data as Record<string, unknown> | undefined;
  const base64 = (data?.qrcode as { base64?: string })?.base64 ?? (data?.base64 as string);
  if (!base64) return undefined;
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}
