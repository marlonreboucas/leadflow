import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { runAgent } from '@leadflow/ai-runtime';
import { SOCKET_EVENTS } from '@leadflow/shared';
import { emitToCompany, emitToConversation } from '../realtime-emit';
import { connection } from '../redis';

const prisma = new PrismaClient();
const SUMMARIZE_EVERY_N = Number(process.env.AI_SUMMARIZE_EVERY_N ?? 12);

type RunAiJob = {
  conversationId: string;
  agentId?: string;
};

export async function processRunAiAgent(job: Job<RunAiJob>) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn('[run-ai-agent] OPENAI_API_KEY missing, skipping');
    return;
  }

  const result = await runAgent(prisma, key, {
    conversationId: job.data.conversationId,
    agentId: job.data.agentId,
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: job.data.conversationId },
    include: { instance: true, contact: true },
  });
  if (!conversation) return;

  const agentId = job.data.agentId ?? conversation.currentAgentId;
  if (!agentId) return;

  const msgCount = await prisma.message.count({
    where: { conversationId: conversation.id },
  });
  if (msgCount >= SUMMARIZE_EVERY_N && msgCount % SUMMARIZE_EVERY_N === 0) {
    const { Queue } = await import('bullmq');
    const { QUEUES } = await import('@leadflow/shared');
    const summarizeQ = new Queue(QUEUES.SUMMARIZE_CONVERSATION, { connection });
    await summarizeQ.add(QUEUES.SUMMARIZE_CONVERSATION, {
      conversationId: conversation.id,
      companyId: conversation.companyId,
    });
    await summarizeQ.close();
  }

  await prisma.aiAgentLog.create({
    data: {
      companyId: conversation.companyId,
      agentId,
      conversationId: conversation.id,
      decision: result.decision,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costCents: result.costCents,
      latencyMs: result.latencyMs,
      payload: { toolCalls: result.toolCalls },
    },
  });

  if (!result.reply) return;

  if (result.suggestOnly) {
    emitToConversation(conversation.id, SOCKET_EVENTS.AI_RESPONSE_GENERATED, {
      conversationId: conversation.id,
      agentId,
      text: result.reply,
      toolCalls: result.toolCalls,
    });
    return;
  }

  const message = await prisma.message.create({
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

  const { Queue } = await import('bullmq');
  const { QUEUES } = await import('@leadflow/shared');
  const sendQ = new Queue(QUEUES.SEND_WHATSAPP, { connection });
  await sendQ.add(QUEUES.SEND_WHATSAPP, {
    messageId: message.id,
    companyId: conversation.companyId,
    instanceExternalName: conversation.instance.externalName,
    to: conversation.contact.phone,
    body: result.reply,
  });
  await sendQ.close();

  emitToConversation(conversation.id, SOCKET_EVENTS.MESSAGE_SENT, { message });
  emitToCompany(conversation.companyId, SOCKET_EVENTS.CONVERSATION_UPDATED, {
    conversationId: conversation.id,
  });
}
