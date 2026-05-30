import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import type {
  CreateDealInput,
  UpdateDealInput,
  ListDealsQuery,
} from '@leadflow/shared';
import { QUEUES, SOCKET_EVENTS } from '@leadflow/shared';
import type { AutomationContext } from '@leadflow/automation';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QueuesService } from '../../queues/queues.service';
import { assertUserInCompany } from '../../common/tenant/tenant-guards';

const dealInclude = {
  contact: { select: { id: true, name: true, phone: true, email: true, avatarUrl: true } },
  stage: { select: { id: true, name: true, position: true, color: true, isWon: true, isLost: true } },
  pipeline: { select: { id: true, name: true } },
  ownerUser: { select: { id: true, name: true, avatarUrl: true } },
  ownerAgent: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly realtime: RealtimeGateway,
    private readonly queues: QueuesService,
  ) {}

  private enqueueAutomation(companyId: string, trigger: string, context: AutomationContext) {
    return this.queues.add(QUEUES.EXECUTE_AUTOMATION, { companyId, trigger, context });
  }

  async list(companyId: string, query: ListDealsQuery) {
    const where: Prisma.DealWhereInput = { companyId };
    if (query.pipelineId) where.pipelineId = query.pipelineId;
    if (query.stageId) where.stageId = query.stageId;
    if (query.ownerUserId) where.ownerUserId = query.ownerUserId;
    if (query.temperature) where.temperature = query.temperature;
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { contact: { name: { contains: query.q, mode: 'insensitive' } } },
        { contact: { phone: { contains: query.q } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        include: dealInclude,
        orderBy: { updatedAt: 'desc' },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { items, total };
  }

  async get(companyId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, companyId },
      include: {
        ...dealInclude,
        tasks: { orderBy: { dueAt: 'asc' } },
      },
    });
    if (!deal) throw new NotFoundException('Lead não encontrado');
    return deal;
  }

  async create(companyId: string, data: CreateDealInput) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: data.pipelineId, companyId },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    if (!pipeline) throw new NotFoundException('Pipeline não encontrado');

    let contactId = data.contactId;
    if (!contactId && data.newContact) {
      const contact = await this.contacts.findOrCreateByPhone(
        companyId,
        data.newContact.phone,
        data.newContact.name,
      );
      contactId = contact.id;
    }
    if (!contactId) {
      throw new BadRequestException('Informe contactId ou newContact');
    }

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!contact) throw new NotFoundException('Contato não encontrado');

    if (data.ownerUserId) await assertUserInCompany(this.prisma, companyId, data.ownerUserId);

    const stageId =
      data.stageId ??
      pipeline.stages.find((s) => !s.isWon && !s.isLost)?.id ??
      pipeline.stages[0]?.id;
    if (!stageId) throw new BadRequestException('Pipeline sem estágios');

    const stage = pipeline.stages.find((s) => s.id === stageId);
    if (!stage) throw new BadRequestException('Estágio inválido para este pipeline');

    const created = await this.prisma.deal.create({
      data: {
        companyId,
        pipelineId: data.pipelineId,
        stageId,
        contactId,
        title: data.title,
        valueCents: data.valueCents,
        temperature: data.temperature,
        ownerUserId: data.ownerUserId,
        nextActionAt: data.nextActionAt,
      },
      include: dealInclude,
    });

    await this.enqueueAutomation(companyId, 'LEAD_CREATED', {
      deal: {
        id: created.id,
        title: created.title,
        stageId: created.stageId,
        stageName: created.stage.name,
        temperature: created.temperature,
        pipelineId: created.pipelineId,
      },
      contact: {
        id: created.contact.id,
        phone: created.contact.phone,
        name: created.contact.name,
      },
    });

    return created;
  }

  async update(companyId: string, id: string, data: UpdateDealInput) {
    await this.get(companyId, id);
    if (data.ownerUserId) await assertUserInCompany(this.prisma, companyId, data.ownerUserId);
    return this.prisma.deal.update({
      where: { id },
      data,
      include: dealInclude,
    });
  }

  async move(companyId: string, id: string, stageId: string, lossReason?: string) {
    const deal = await this.get(companyId, id);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId: deal.pipelineId },
    });
    if (!stage) throw new BadRequestException('Estágio inválido para este pipeline');

    const status =
      stage.isWon ? 'WON' : stage.isLost ? 'LOST' : deal.status === 'OPEN' ? 'OPEN' : deal.status;

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        stageId,
        status,
        closedAt: stage.isWon || stage.isLost ? new Date() : null,
        lossReason: stage.isLost ? (lossReason ?? deal.lossReason) : null,
        winReason: stage.isWon ? deal.winReason : null,
      },
      include: dealInclude,
    });

    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.DEAL_MOVED, {
      dealId: updated.id,
      pipelineId: updated.pipelineId,
      fromStageId: deal.stageId,
      toStageId: stageId,
      deal: updated,
    });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.LEAD_UPDATED, { deal: updated });

    await this.enqueueAutomation(companyId, 'LEAD_STAGE_CHANGED', {
      deal: {
        id: updated.id,
        title: updated.title,
        stageId: updated.stageId,
        stageName: updated.stage.name,
        temperature: updated.temperature,
        pipelineId: updated.pipelineId,
      },
      contact: {
        id: updated.contact.id,
        phone: updated.contact.phone,
        name: updated.contact.name,
      },
      fromStageId: deal.stageId,
      toStageId: stageId,
    });

    return updated;
  }

  async close(
    companyId: string,
    id: string,
    status: 'WON' | 'LOST',
    lossReason?: string,
    winReason?: string,
  ) {
    const deal = await this.get(companyId, id);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: {
        pipelineId: deal.pipelineId,
        isWon: status === 'WON',
        isLost: status === 'LOST',
      },
      orderBy: { position: 'asc' },
    });
    if (!stage) {
      throw new BadRequestException(
        `Pipeline não possui estágio de ${status === 'WON' ? 'ganho' : 'perda'}`,
      );
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        status,
        stageId: stage.id,
        closedAt: new Date(),
        lossReason: status === 'LOST' ? lossReason : null,
        winReason: status === 'WON' ? winReason : null,
      },
      include: dealInclude,
    });

    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.DEAL_MOVED, {
      dealId: updated.id,
      pipelineId: updated.pipelineId,
      fromStageId: deal.stageId,
      toStageId: stage.id,
      deal: updated,
    });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.LEAD_UPDATED, { deal: updated });

    return updated;
  }

  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.deal.delete({ where: { id } });
    return { ok: true };
  }

  async getTimeline(companyId: string, dealId: string) {
    const deal = await this.get(companyId, dealId);
    type TimelineItem = {
      id: string;
      type: 'message' | 'ai' | 'task' | 'deal';
      at: string;
      title: string;
      body?: string | null;
      meta?: Record<string, string>;
    };
    const items: TimelineItem[] = [];

    items.push({
      id: `deal-${deal.id}`,
      type: 'deal',
      at: deal.createdAt.toISOString(),
      title: 'Lead criado',
      body: deal.title,
    });

    const conversations = await this.prisma.conversation.findMany({
      where: { companyId, contactId: deal.contactId },
      select: { id: true },
    });
    const convIds = conversations.map((c) => c.id);

    if (convIds.length) {
      const messages = await this.prisma.message.findMany({
        where: { conversationId: { in: convIds } },
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: { senderAgent: { select: { name: true } } },
      });
      for (const m of messages) {
        items.push({
          id: m.id,
          type: 'message',
          at: m.createdAt.toISOString(),
          title:
            m.direction === 'INBOUND'
              ? 'Mensagem recebida'
              : m.senderType === 'AI_AGENT'
                ? `IA${m.senderAgent ? ` (${m.senderAgent.name})` : ''}`
                : 'Mensagem enviada',
          body: m.body,
          meta: { direction: m.direction, status: m.status },
        });
      }

      const aiLogs = await this.prisma.aiAgentLog.findMany({
        where: { companyId, conversationId: { in: convIds } },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { agent: { select: { name: true } } },
      });
      for (const log of aiLogs) {
        items.push({
          id: log.id,
          type: 'ai',
          at: log.createdAt.toISOString(),
          title: `Decisão IA — ${log.agent.name}`,
          body: log.decision,
          meta: {
            tokens: String(log.inputTokens + log.outputTokens),
            tools: Array.isArray((log.payload as { toolCalls?: string[] })?.toolCalls)
              ? ((log.payload as { toolCalls: string[] }).toolCalls.join(', ') || '—')
              : '—',
          },
        });
      }
    }

    const tasks = await this.prisma.task.findMany({
      where: { companyId, dealId: deal.id },
      orderBy: { createdAt: 'desc' },
      include: { createdByAgent: { select: { name: true } } },
    });
    for (const t of tasks) {
      items.push({
        id: t.id,
        type: 'task',
        at: (t.dueAt ?? t.createdAt).toISOString(),
        title: t.createdByAgent ? `Tarefa (IA: ${t.createdByAgent.name})` : 'Tarefa',
        body: t.title,
        meta: { status: t.status },
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { items };
  }
}
