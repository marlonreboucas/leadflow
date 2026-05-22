import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DealsService } from '../../modules/deals/deals.service';
import { QueuesService } from '../../queues/queues.service';
import { QUEUES } from '@leadflow/shared';
import { verifyN8nSignature } from './n8n-signer';
import type { CreateDealInput } from '@leadflow/shared';

@Injectable()
export class N8nService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deals: DealsService,
    private readonly queues: QueuesService,
  ) {}

  listWebhooks(companyId: string) {
    return this.prisma.n8nWebhook.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        retries: true,
        createdAt: true,
      },
    });
  }

  createWebhook(companyId: string, input: { name: string; url: string; events: string[] }) {
    const secret = cryptoRandom();
    return this.prisma.n8nWebhook.create({
      data: {
        companyId,
        name: input.name,
        url: input.url,
        secret,
        events: input.events,
        isActive: true,
      },
      select: { id: true, name: true, url: true, secret: true, events: true, isActive: true },
    });
  }

  dispatch(companyId: string, event: string, data: unknown) {
    return this.queues.add(QUEUES.SEND_TO_N8N, { companyId, event, data });
  }

  async handleInbound(
    companyId: string,
    slug: string,
    rawBody: string,
    signature: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const hook = await this.prisma.n8nWebhook.findFirst({
      where: { companyId, name: slug, isActive: true },
    });
    if (!hook) throw new NotFoundException('Webhook n8n não encontrado');

    if (signature && !verifyN8nSignature(rawBody, hook.secret, signature)) {
      throw new UnauthorizedException('Assinatura HMAC inválida');
    }

    const action = String(payload.action ?? '');

    if (action === 'create_lead') {
      const pipeline = await this.prisma.pipeline.findFirst({
        where: { companyId, isDefault: true },
        include: { stages: { orderBy: { position: 'asc' } } },
      });
      if (!pipeline?.stages[0]) {
        throw new BadRequestException('Pipeline padrão sem estágios');
      }
      const body: CreateDealInput = {
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0].id,
        title: String(payload.title ?? 'Lead n8n'),
        newContact: {
          phone: String(payload.phone ?? ''),
          name: payload.name ? String(payload.name) : undefined,
        },
        valueCents: Number(payload.valueCents ?? 0),
        temperature: (payload.temperature as 'COLD' | 'WARM' | 'HOT') ?? 'COLD',
      };
      return this.deals.create(companyId, body);
    }

    if (action === 'move_stage') {
      const dealId = String(payload.dealId ?? '');
      const stageId = String(payload.stageId ?? '');
      if (!dealId || !stageId) throw new BadRequestException('dealId e stageId obrigatórios');
      return this.deals.move(companyId, dealId, stageId);
    }

    throw new BadRequestException(`Ação n8n não suportada: ${action}`);
  }
}

function cryptoRandom() {
  return randomBytes(32).toString('hex');
}
