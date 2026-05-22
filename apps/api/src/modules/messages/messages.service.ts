import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import { QueuesService } from '../../queues/queues.service';
import { UsageLimiterService } from '../billing/usage-limiter.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QUEUES, SOCKET_EVENTS } from '@leadflow/shared';
import type { SendMessageInput, ListMessagesQuery } from '@leadflow/shared';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
    private readonly realtime: RealtimeGateway,
    private readonly usage: UsageLimiterService,
  ) {}

  async list(conversationId: string, companyId: string, query: ListMessagesQuery) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');

    const where: Prisma.MessageWhereInput = { conversationId, companyId };
    if (query.cursor) {
      const cursorMsg = await this.prisma.message.findFirst({
        where: { id: query.cursor, conversationId },
      });
      if (cursorMsg) where.createdAt = { lt: cursorMsg.createdAt };
    }

    const items = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.take + 1,
    });

    const hasMore = items.length > query.take;
    const slice = hasMore ? items.slice(0, query.take) : items;
    return {
      items: slice.reverse(),
      nextCursor: hasMore ? slice[0]?.id : undefined,
    };
  }

  async send(companyId: string, userId: string, input: SendMessageInput) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: input.conversationId, companyId },
      include: { instance: true, contact: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    if (conv.instance.status !== 'CONNECTED') {
      throw new BadRequestException('WhatsApp não conectado nesta instância');
    }

    await this.usage.assertCanSendMessage(companyId);

    const message = await this.prisma.message.create({
      data: {
        companyId,
        conversationId: conv.id,
        direction: 'OUTBOUND',
        status: 'PENDING',
        senderType: 'USER',
        senderUserId: userId,
        body: input.body,
        type: 'TEXT',
      },
    });

    await this.queues.add(QUEUES.SEND_WHATSAPP, {
      messageId: message.id,
      companyId,
      instanceExternalName: conv.instance.externalName,
      to: conv.contact.phone,
      body: input.body,
    });

    await this.usage.incrementMessages(companyId);

    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date() },
    });

    this.realtime.emitToConversation(conv.id, SOCKET_EVENTS.MESSAGE_SENT, { message });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId: conv.id,
    });

    return message;
  }
}
