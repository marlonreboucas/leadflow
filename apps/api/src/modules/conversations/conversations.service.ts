import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DealsService } from '../deals/deals.service';
import { QueuesService } from '../../queues/queues.service';
import { QUEUES, SOCKET_EVENTS } from '@leadflow/shared';
import type { ListConversationsQuery } from '@leadflow/shared';

const include = {
  contact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
  instance: { select: { id: true, phoneNumber: true, status: true } },
  currentAgent: { select: { id: true, name: true, avatarUrl: true, mode: true } },
} satisfies Prisma.ConversationInclude;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly deals: DealsService,
    private readonly queues: QueuesService,
  ) {}

  async findOrCreate(companyId: string, contactId: string, instanceId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { companyId, contactId, instanceId },
    });
    if (existing) return existing;

    const created = await this.prisma.conversation.create({
      data: {
        companyId,
        contactId,
        instanceId,
        status: 'NEW',
        handlingMode: 'AI_FIRST',
      },
    });

    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_CREATED, {
      conversationId: created.id,
    });

    return created;
  }

  /** Contato fictício do playground de agentes — não listar no Inbox. */
  private static readonly PLAYGROUND_PHONE = '5500000000000';

  async list(companyId: string, query: ListConversationsQuery, currentUserId?: string) {
    const where: Prisma.ConversationWhereInput = {
      companyId,
      contact: { phone: { not: ConversationsService.PLAYGROUND_PHONE } },
    };
    if (query.status) where.status = query.status;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;

    switch (query.filter) {
      case 'unread':
        where.unreadCount = { gt: 0 };
        break;
      case 'mine':
        if (currentUserId) where.assignedUserId = currentUserId;
        break;
      case 'no_deal':
        where.deals = { none: { status: 'OPEN' } };
        break;
      case 'hot':
        where.deals = { some: { status: 'OPEN', temperature: 'HOT' } };
        break;
    }
    if (query.instanceId) where.instanceId = query.instanceId;
    if (query.q) {
      where.contact = {
        phone: { not: ConversationsService.PLAYGROUND_PHONE },
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { phone: { contains: query.q } },
        ],
      };
    }
    if (query.cursor) {
      const cursorConv = await this.prisma.conversation.findFirst({
        where: { id: query.cursor, companyId },
      });
      if (cursorConv?.lastMessageAt) {
        where.lastMessageAt = { lt: cursorConv.lastMessageAt };
      }
    }

    const items = await this.prisma.conversation.findMany({
      where,
      include: {
        ...include,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        deals: {
          where: { status: 'OPEN' },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            valueCents: true,
            temperature: true,
            stage: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: query.take + 1,
    });

    const hasMore = items.length > query.take;
    const slice = hasMore ? items.slice(0, query.take) : items;
    const nextCursor = hasMore ? slice[slice.length - 1]?.id : undefined;

    return {
      items: slice.map((c) => ({
        ...c,
        lastMessage: c.messages[0] ?? null,
        messages: undefined,
      })),
      nextCursor,
    };
  }

  async get(companyId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        ...include,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        deals: {
          take: 5,
          orderBy: { updatedAt: 'desc' },
          include: {
            stage: { select: { id: true, name: true, isWon: true, isLost: true } },
            pipeline: { select: { id: true, name: true } },
            tasks: {
              where: { status: { in: ['PENDING', 'DOING'] } },
              orderBy: { dueAt: 'asc' },
              take: 5,
              select: { id: true, title: true, status: true, dueAt: true, kind: true },
            },
          },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    const { messages, ...rest } = conversation;
    return { ...rest, lastMessage: messages[0] ?? null };
  }

  async assume(companyId: string, id: string, userId: string) {
    await this.get(companyId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        assignedUserId: userId,
        status: 'IN_PROGRESS',
        isAiPaused: true,
      },
      include,
    });

    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.AGENT_ASSIGNED, {
      conversationId: id,
      userId,
    });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId: id,
    });

    return updated;
  }

  async markRead(companyId: string, id: string) {
    await this.get(companyId, id);
    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  async pauseAi(companyId: string, id: string, reason?: string) {
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { isAiPaused: true, aiPausedReason: reason ?? 'Pausado manualmente' },
      include,
    });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId: id,
    });
    return updated;
  }

  async resumeAi(companyId: string, id: string) {
    const conv = await this.get(companyId, id);
    let agentId = conv.currentAgentId;
    if (!agentId) {
      const agent = await this.prisma.aiAgent.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      agentId = agent?.id ?? null;
    }
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        isAiPaused: false,
        aiPausedReason: null,
        currentAgentId: agentId,
        handlingMode: 'AI_FIRST',
      },
      include,
    });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId: id,
    });
    return updated;
  }

  async runAi(companyId: string, id: string) {
    const conv = await this.get(companyId, id);
    if (!conv.currentAgentId) {
      throw new BadRequestException('Nenhum agente IA atribuído à conversa');
    }
    await this.queues.add(QUEUES.RUN_AI_AGENT, {
      conversationId: id,
      agentId: conv.currentAgentId,
    });
    return { queued: true };
  }

  async createDeal(
    companyId: string,
    conversationId: string,
    body: { title: string; pipelineId?: string; valueCents?: number },
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      include: { contact: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');

    const pipeline =
      body.pipelineId != null
        ? await this.prisma.pipeline.findFirst({
            where: { id: body.pipelineId, companyId },
          })
        : await this.prisma.pipeline.findFirst({
            where: { companyId, isDefault: true },
          });
    if (!pipeline) throw new BadRequestException('Nenhum pipeline encontrado');

    const deal = await this.deals.create(companyId, {
      pipelineId: pipeline.id,
      contactId: conv.contactId,
      title: body.title,
      valueCents: body.valueCents ?? 0,
      temperature: 'WARM',
    });

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { conversationId: conv.id },
    });

    return deal;
  }
}
