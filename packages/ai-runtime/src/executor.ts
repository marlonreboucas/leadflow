import type { PrismaClient } from '@leadflow/database';
import { QUEUES } from '@leadflow/shared';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { ToolName } from './tools';
import { formatAppointmentPt, parseAppointmentDueAt } from './scheduling';

export type ToolResult = { ok: boolean; message: string };

async function resolveStageId(
  prisma: PrismaClient,
  pipelineId: string,
  stageId?: string,
  stageName?: string,
) {
  if (stageId) {
    const s = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId } });
    if (s) return s;
  }
  if (stageName) {
    const stages = await prisma.pipelineStage.findMany({ where: { pipelineId } });
    const norm = stageName.trim().toLowerCase();
    return (
      stages.find((s) => s.name.toLowerCase() === norm) ??
      stages.find((s) => s.name.toLowerCase().includes(norm))
    );
  }
  return null;
}

export async function executeTool(
  prisma: PrismaClient,
  companyId: string,
  agentId: string,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case 'move_deal_stage': {
      const dealId = String(args.dealId);
      const deal = await prisma.deal.findFirst({ where: { id: dealId, companyId } });
      if (!deal) return { ok: false, message: 'Deal não encontrado' };
      const stage = await resolveStageId(
        prisma,
        deal.pipelineId,
        args.stageId ? String(args.stageId) : undefined,
        args.stageName ? String(args.stageName) : undefined,
      );
      if (!stage) return { ok: false, message: 'Estágio não encontrado' };
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          stageId: stage.id,
          status: stage.isWon ? 'WON' : stage.isLost ? 'LOST' : deal.status,
          closedAt: stage.isWon || stage.isLost ? new Date() : null,
        },
      });
      return { ok: true, message: `Deal movido para ${stage.name}` };
    }
    case 'create_task': {
      const dueAt = args.dueAt ? new Date(String(args.dueAt)) : undefined;
      await prisma.task.create({
        data: {
          companyId,
          title: String(args.title),
          dealId: args.dealId ? String(args.dealId) : undefined,
          dueAt,
          createdByAgentId: agentId,
          status: 'PENDING',
          kind: 'TASK',
        },
      });
      return { ok: true, message: 'Tarefa criada' };
    }
    case 'schedule_event': {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { timezone: true, name: true },
      });
      const tz = company?.timezone ?? 'America/Sao_Paulo';
      let dueAt: Date | undefined;
      if (args.dueAt) {
        dueAt = new Date(String(args.dueAt));
      } else if (args.dueAtText) {
        dueAt = parseAppointmentDueAt(String(args.dueAtText), new Date(), tz) ?? undefined;
      }
      if (!dueAt || Number.isNaN(dueAt.getTime())) {
        return {
          ok: false,
          message: 'Informe dueAt (ISO) ou dueAtText (ex: amanhã 14h)',
        };
      }

      const conversationId = args.conversationId ? String(args.conversationId) : undefined;
      const task = await prisma.task.create({
        data: {
          companyId,
          title: String(args.title),
          description: args.description ? String(args.description) : undefined,
          dealId: args.dealId ? String(args.dealId) : undefined,
          conversationId,
          dueAt,
          durationMinutes: args.durationMinutes != null ? Number(args.durationMinutes) : 60,
          createdByAgentId: agentId,
          status: 'PENDING',
          kind: 'APPOINTMENT',
        },
      });

      if (conversationId) {
        const conv = await prisma.conversation.findFirst({
          where: { id: conversationId, companyId },
          include: { contact: true, instance: true },
        });
        if (conv?.instance.status === 'CONNECTED') {
          const when = formatAppointmentPt(dueAt, tz);
          const body = `✅ Agendamento confirmado: *${task.title}*\n📅 ${when}\n— ${company?.name ?? 'LeadFlow'}`;
          const message = await prisma.message.create({
            data: {
              companyId,
              conversationId: conv.id,
              direction: 'OUTBOUND',
              status: 'PENDING',
              senderType: 'AI_AGENT',
              senderAgentId: agentId,
              body,
              type: 'TEXT',
            },
          });
          const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
          const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
          const queue = new Queue(QUEUES.SEND_WHATSAPP, { connection });
          await queue.add(QUEUES.SEND_WHATSAPP, {
            messageId: message.id,
            companyId,
            instanceExternalName: conv.instance.externalName,
            to: conv.contact.phone,
            body,
          });
          await queue.close();
          await connection.quit();
        }
      }

      const redisUrl2 = process.env.REDIS_URL ?? 'redis://localhost:6379';
      const syncConn = new Redis(redisUrl2, { maxRetriesPerRequest: null });
      const syncQ = new Queue(QUEUES.SYNC_GOOGLE_CALENDAR, { connection: syncConn });
      await syncQ.add(QUEUES.SYNC_GOOGLE_CALENDAR, { companyId, taskId: task.id });
      await syncQ.close();
      await syncConn.quit();

      return {
        ok: true,
        message: `Compromisso agendado para ${formatAppointmentPt(dueAt, tz)}`,
      };
    }
    case 'apply_tag': {
      const dealId = String(args.dealId);
      const tagName = String(args.tagName).trim();
      const deal = await prisma.deal.findFirst({ where: { id: dealId, companyId } });
      if (!deal) return { ok: false, message: 'Deal não encontrado' };
      let tag = await prisma.tag.findFirst({
        where: { companyId, name: { equals: tagName, mode: 'insensitive' } },
      });
      if (!tag) {
        tag = await prisma.tag.create({ data: { companyId, name: tagName } });
      }
      await prisma.dealTag.upsert({
        where: { dealId_tagId: { dealId, tagId: tag.id } },
        create: { dealId, tagId: tag.id },
        update: {},
      });
      return { ok: true, message: `Tag "${tag.name}" aplicada` };
    }
    case 'send_template': {
      const templateName = String(args.templateName).trim();
      const conversationId = String(args.conversationId);
      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, companyId },
        include: { contact: true, instance: true },
      });
      if (!conv) return { ok: false, message: 'Conversa não encontrada' };
      const template = await prisma.messageTemplate.findFirst({
        where: { companyId, name: { equals: templateName, mode: 'insensitive' } },
      });
      if (!template) return { ok: false, message: 'Template não encontrado' };
      const message = await prisma.message.create({
        data: {
          companyId,
          conversationId: conv.id,
          direction: 'OUTBOUND',
          status: 'PENDING',
          senderType: 'AI_AGENT',
          senderAgentId: agentId,
          body: template.body,
          type: 'TEXT',
        },
      });
      const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
      const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
      const queue = new Queue(QUEUES.SEND_WHATSAPP, { connection });
      await queue.add(QUEUES.SEND_WHATSAPP, {
        messageId: message.id,
        companyId,
        instanceExternalName: conv.instance.externalName,
        to: conv.contact.phone,
        body: template.body,
      });
      await queue.close();
      await connection.quit();
      return { ok: true, message: `Template "${template.name}" enfileirado` };
    }
    case 'transfer_to_human': {
      const convId = args.conversationId as string | undefined;
      if (convId) {
        await prisma.conversation.update({
          where: { id: convId },
          data: {
            isAiPaused: true,
            aiPausedReason: String(args.reason ?? 'Solicitado pelo cliente'),
            status: 'WAITING_HUMAN',
            currentAgentId: null,
          },
        });
      }
      return { ok: true, message: 'Transferido para humano' };
    }
    case 'update_lead_field': {
      const dealId = String(args.dealId);
      const deal = await prisma.deal.findFirst({ where: { id: dealId, companyId } });
      if (!deal) return { ok: false, message: 'Deal não encontrado' };
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          title: args.title ? String(args.title) : undefined,
          valueCents: args.valueCents != null ? Number(args.valueCents) : undefined,
          temperature:
            args.temperature != null
              ? (String(args.temperature) as 'COLD' | 'WARM' | 'HOT')
              : undefined,
        },
      });
      return { ok: true, message: 'Lead atualizado' };
    }
    default:
      return { ok: false, message: 'Tool desconhecida' };
  }
}
