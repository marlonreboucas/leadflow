import type { Job } from 'bullmq';
import axios from 'axios';
import { PrismaClient } from '@leadflow/database';
import { SOCKET_EVENTS } from '@leadflow/shared';
import { emitToCompany, emitToConversation } from '../realtime-emit';

const prisma = new PrismaClient();

type SendJob = {
  messageId: string;
  companyId: string;
  instanceExternalName: string;
  to: string;
  body: string;
};

export async function processSendWhatsapp(job: Job<SendJob>) {
  const { messageId, companyId, instanceExternalName, to, body } = job.data;
  const baseUrl = (process.env.EVOLUTION_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
  const apikey = process.env.EVOLUTION_API_KEY ?? '';

  try {
    const { data } = await axios.post(
      `${baseUrl}/message/sendText/${instanceExternalName}`,
      { number: to.replace(/\D/g, ''), text: body },
      { headers: { apikey }, timeout: 30_000 },
    );

    const externalId =
      (data as { key?: { id?: string } })?.key?.id ??
      (data as { messageId?: string })?.messageId;

    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        externalId: externalId ? String(externalId) : undefined,
        sentAt: new Date(),
      },
    });

    emitToConversation(message.conversationId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATED, {
      message,
    });
    emitToConversation(message.conversationId, SOCKET_EVENTS.MESSAGE_SENT, { message });
    emitToCompany(companyId, SOCKET_EVENTS.CONVERSATION_UPDATED, {
      conversationId: message.conversationId,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'send failed';
    const message = await prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED', errorReason: reason },
    });
    emitToConversation(message.conversationId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATED, {
      message,
    });
    throw err;
  }
}
