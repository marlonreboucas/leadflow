import { Injectable } from '@nestjs/common';
import { runAgent, type RunAgentOptions, type RunAgentResult } from '@leadflow/ai-runtime';
import { PrismaService } from '../../prisma/prisma.service';
import { QueuesService } from '../../queues/queues.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { env } from '../../config/env';
import { QUEUES, SOCKET_EVENTS } from '@leadflow/shared';

@Injectable()
export class AiRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async run(options: RunAgentOptions): Promise<RunAgentResult> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const result = await runAgent(this.prisma, env.OPENAI_API_KEY, options);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: options.conversationId },
      include: { instance: true },
    });
    if (!conversation) return result;

    const agentId = options.agentId ?? conversation.currentAgentId;
    if (!agentId) return result;

    if (!options.testMessage) {
      await this.prisma.aiAgentLog.create({
        data: {
          companyId: conversation.companyId,
          agentId,
          conversationId: conversation.id,
          decision: result.decision,
          reasoning: result.reasoning,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCents: result.costCents,
          latencyMs: result.latencyMs,
          payload: { toolCalls: result.toolCalls },
        },
      });
    }

    if (!options.testMessage && !result.suggestOnly && result.reply) {
      const message = await this.prisma.message.create({
        data: {
          companyId: conversation.companyId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          status: 'PENDING',
          senderType: 'AI_AGENT',
          senderAgentId: agentId,
          body: result.reply,
          type: 'TEXT',
        },
      });

      await this.queues.add(QUEUES.SEND_WHATSAPP, {
        messageId: message.id,
        companyId: conversation.companyId,
        instanceExternalName: conversation.instance.externalName,
        to: (await this.prisma.contact.findUnique({ where: { id: conversation.contactId } }))!
          .phone,
        body: result.reply,
      });

      this.realtime.emitToConversation(conversation.id, SOCKET_EVENTS.MESSAGE_SENT, { message });
    } else if (result.reply) {
      this.realtime.emitToConversation(conversation.id, SOCKET_EVENTS.AI_RESPONSE_GENERATED, {
        conversationId: conversation.id,
        agentId,
        text: result.reply,
        toolCalls: result.toolCalls,
      });
    }

    const msgCount = await this.prisma.message.count({
      where: { conversationId: conversation.id },
    });
    if (msgCount > 0 && msgCount % 20 === 0) {
      await this.queues.add(QUEUES.SUMMARIZE_CONVERSATION, {
        conversationId: conversation.id,
        companyId: conversation.companyId,
      });
    }

    return result;
  }
}
