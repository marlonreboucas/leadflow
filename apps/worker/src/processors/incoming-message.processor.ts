import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { QUEUES, SOCKET_EVENTS } from '@leadflow/shared';
import { connection } from '../redis';
import { emitToCompany, emitToConversation } from '../realtime-emit';

const prisma = new PrismaClient();
const aiQueue = new Queue(QUEUES.RUN_AI_AGENT, { connection });
const classifyQueue = new Queue(QUEUES.CLASSIFY_LEAD, { connection });
const summarizeQueue = new Queue(QUEUES.SUMMARIZE_CONVERSATION, { connection });
const automationQueue = new Queue(QUEUES.EXECUTE_AUTOMATION, { connection });

const SUMMARIZE_EVERY_N = Number(process.env.AI_SUMMARIZE_EVERY_N ?? 12);

const AI_MODES = new Set(['AI_FIRST', 'AI', 'AI_SUGGEST', 'AUTO_ROUTING']);

type IncomingJob = {
  companyId: string;
  instanceId: string;
  externalName: string;
  payload: {
    event?: string;
    data?: unknown;
  };
};

function parseOneMessage(item: Record<string, unknown>) {
  const key = (item.key ?? item) as Record<string, unknown>;
  const msg = (item.message ?? item) as Record<string, unknown>;
  const remoteJid = String(
    key?.remoteJid ?? item.remoteJid ?? (item as { remoteJid?: string }).remoteJid ?? '',
  );
  const phone = remoteJid.replace(/@.*/, '').replace(/\D/g, '');
  const externalId = String(key?.id ?? item.id ?? '');
  const fromMe = Boolean(key?.fromMe ?? item.fromMe);
  const body =
    (msg?.conversation as string) ??
    ((msg?.extendedTextMessage as Record<string, unknown>)?.text as string) ??
    (item.body as string);
  const name = (item.pushName as string) ?? undefined;
  if (!phone || !externalId || fromMe) return null;
  return { externalId, phone, name, body, fromMe };
}

function extractMessages(payload: IncomingJob['payload']): Array<{
  externalId: string;
  phone: string;
  name?: string;
  body?: string;
  fromMe: boolean;
}> {
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return [];

  if (data.key || data.remoteJid) {
    const one = parseOneMessage(data);
    return one ? [one] : [];
  }

  const raw = (data.messages ?? data.message ?? data) as unknown;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return list
    .map((item) => parseOneMessage(item as Record<string, unknown>))
    .filter(Boolean) as Array<{
    externalId: string;
    phone: string;
    name?: string;
    body?: string;
    fromMe: boolean;
  }>;
}

export async function processIncomingMessage(job: Job<IncomingJob>) {
  const { companyId, instanceId, payload } = job.data;
  const messages = extractMessages(payload);

  for (const incoming of messages) {
    const dup = await prisma.message.findUnique({
      where: { externalId: incoming.externalId },
    });
    if (dup) continue;

    const contact = await prisma.contact.upsert({
      where: { companyId_phone: { companyId, phone: incoming.phone } },
      create: {
        companyId,
        phone: incoming.phone,
        name: incoming.name,
        origin: 'whatsapp',
      },
      update: incoming.name ? { name: incoming.name } : {},
    });

    let conversation = await prisma.conversation.findFirst({
      where: { companyId, contactId: contact.id, instanceId },
    });
    if (!conversation) {
      const defaultAgent = await prisma.aiAgent.findFirst({
        where: { companyId, isActive: true, type: 'SDR' },
        orderBy: { createdAt: 'asc' },
      });
      conversation = await prisma.conversation.create({
        data: {
          companyId,
          contactId: contact.id,
          instanceId,
          status: 'NEW',
          handlingMode: 'AI_FIRST',
          currentAgentId: defaultAgent?.id,
        },
      });
      emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_CREATED, {
        conversationId: conversation.id,
      });
    }

    const message = await prisma.message.create({
      data: {
        companyId,
        conversationId: conversation.id,
        externalId: incoming.externalId,
        direction: 'INBOUND',
        status: 'DELIVERED',
        senderType: 'CONTACT',
        body: incoming.body ?? '',
        type: 'TEXT',
      },
    });

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    emitToConversation(conversation.id, SOCKET_EVENTS.MESSAGE_RECEIVED, { message });
    emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId: conversation.id,
    });

    const openDeal = await prisma.deal.findFirst({
      where: { companyId, contactId: contact.id, status: 'OPEN' },
      orderBy: { updatedAt: 'desc' },
      include: { stage: true },
    });
    if (openDeal && incoming.body) {
      await classifyQueue.add(QUEUES.CLASSIFY_LEAD, {
        companyId,
        dealId: openDeal.id,
        messageBody: incoming.body,
      });
    }

    await automationQueue.add(QUEUES.EXECUTE_AUTOMATION, {
      companyId,
      trigger: 'MESSAGE_RECEIVED',
      context: {
        message: { body: incoming.body, direction: 'INBOUND' },
        conversation: { id: conversation.id, status: updated.status },
        contact: { id: contact.id, phone: contact.phone, name: contact.name },
        deal: openDeal
          ? {
              id: openDeal.id,
              title: openDeal.title,
              stageId: openDeal.stageId,
              stageName: openDeal.stage.name,
              temperature: openDeal.temperature,
              pipelineId: openDeal.pipelineId,
            }
          : null,
      },
    });

    const msgCount = await prisma.message.count({
      where: { conversationId: conversation.id },
    });
    if (msgCount >= SUMMARIZE_EVERY_N && msgCount % SUMMARIZE_EVERY_N === 0) {
      await summarizeQueue.add(QUEUES.SUMMARIZE_CONVERSATION, {
        conversationId: conversation.id,
        companyId,
      });
    }

    if (
      !updated.isAiPaused &&
      AI_MODES.has(updated.handlingMode) &&
      updated.currentAgentId &&
      process.env.OPENAI_API_KEY
    ) {
      await aiQueue.add(QUEUES.RUN_AI_AGENT, {
        conversationId: updated.id,
        agentId: updated.currentAgentId,
      });
    }
  }
}
