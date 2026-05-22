import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { QUEUES } from '@leadflow/shared';
import { formatAppointmentPt } from '@leadflow/ai-runtime';
import { connection } from '../redis';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

const REMINDER_HOURS_BEFORE = Number(process.env.APPOINTMENT_REMINDER_HOURS ?? 24);

export async function processAppointmentReminderScanner(_job: Job) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 3600000);

  const appointments = await prisma.task.findMany({
    where: {
      kind: 'APPOINTMENT',
      status: 'PENDING',
      dueAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
      conversationId: { not: null },
    },
    include: {
      company: { select: { timezone: true } },
      conversation: {
        include: { contact: true, instance: true },
      },
    },
    take: 50,
  });

  const sendQ = new Queue(QUEUES.SEND_WHATSAPP, { connection });

  for (const apt of appointments) {
    const conv = apt.conversation;
    if (!conv || conv.instance.status !== 'CONNECTED') continue;

    const tz = apt.company.timezone ?? 'America/Sao_Paulo';
    const when = apt.dueAt ? formatAppointmentPt(apt.dueAt, tz) : 'em breve';
    const body = `🔔 Lembrete: *${apt.title}*\n📅 ${when}`;

    const message = await prisma.message.create({
      data: {
        companyId: apt.companyId,
        conversationId: conv.id,
        direction: 'OUTBOUND',
        status: 'PENDING',
        senderType: 'AI_AGENT',
        body,
        type: 'TEXT',
      },
    });

    await sendQ.add(QUEUES.SEND_WHATSAPP, {
      messageId: message.id,
      companyId: apt.companyId,
      instanceExternalName: conv.instance.externalName,
      to: conv.contact.phone,
      body,
    });

    await prisma.task.update({
      where: { id: apt.id },
      data: { reminderSentAt: new Date() },
    });
  }

  await sendQ.close();
}
