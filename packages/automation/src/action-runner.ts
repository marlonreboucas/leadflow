import type { PrismaClient } from '@leadflow/database';
import { QUEUES } from '@leadflow/shared';
import type { ActionLogEntry, AutomationContext, QueueAddFn } from './types';

type ActionRow = {
  type: string;
  config: unknown;
};

export async function runAction(
  prisma: PrismaClient,
  addQueue: QueueAddFn,
  companyId: string,
  action: ActionRow,
  ctx: AutomationContext,
): Promise<ActionLogEntry> {
  const config = (action.config ?? {}) as Record<string, unknown>;
  const convId = ctx.conversation?.id;

  try {
    switch (action.type) {
      case 'SEND_WHATSAPP_MESSAGE': {
        if (!convId) return { type: action.type, ok: false, message: 'Sem conversa' };
        const conv = await prisma.conversation.findFirst({
          where: { id: convId, companyId },
          include: { instance: true, contact: true },
        });
        if (!conv || conv.instance.status !== 'CONNECTED') {
          return { type: action.type, ok: false, message: 'WhatsApp não conectado' };
        }
        let body = String(config.body ?? '');
        if (config.templateName) {
          const tpl = await prisma.messageTemplate.findFirst({
            where: {
              companyId,
              name: { equals: String(config.templateName), mode: 'insensitive' },
            },
          });
          if (!tpl) return { type: action.type, ok: false, message: 'Template não encontrado' };
          body = tpl.body;
        }
        if (!body.trim()) return { type: action.type, ok: false, message: 'Corpo vazio' };
        const message = await prisma.message.create({
          data: {
            companyId,
            conversationId: conv.id,
            direction: 'OUTBOUND',
            status: 'PENDING',
            senderType: 'AI_AGENT',
            body,
            type: 'TEXT',
          },
        });
        await addQueue(QUEUES.SEND_WHATSAPP, {
          messageId: message.id,
          companyId,
          instanceExternalName: conv.instance.externalName,
          to: conv.contact.phone,
          body,
        });
        return { type: action.type, ok: true, message: 'Mensagem enfileirada' };
      }

      case 'RUN_AI_AGENT': {
        if (!convId) return { type: action.type, ok: false, message: 'Sem conversa' };
        const conv = await prisma.conversation.findFirst({ where: { id: convId, companyId } });
        if (!conv?.currentAgentId) {
          return { type: action.type, ok: false, message: 'Sem agente na conversa' };
        }
        await addQueue(QUEUES.RUN_AI_AGENT, {
          conversationId: convId,
          agentId: conv.currentAgentId,
        });
        return { type: action.type, ok: true, message: 'IA enfileirada' };
      }

      case 'PAUSE_AI': {
        if (!convId) return { type: action.type, ok: false, message: 'Sem conversa' };
        await prisma.conversation.update({
          where: { id: convId },
          data: {
            isAiPaused: true,
            aiPausedReason: String(config.reason ?? 'Automação'),
          },
        });
        return { type: action.type, ok: true, message: 'IA pausada' };
      }

      case 'MOVE_STAGE': {
        const dealId = String(config.dealId ?? ctx.deal?.id ?? '');
        if (!dealId) return { type: action.type, ok: false, message: 'Sem deal' };
        const deal = await prisma.deal.findFirst({ where: { id: dealId, companyId } });
        if (!deal) return { type: action.type, ok: false, message: 'Deal não encontrado' };
        let stageId = config.stageId ? String(config.stageId) : undefined;
        if (!stageId && config.stageName) {
          const norm = String(config.stageName).trim().toLowerCase();
          const stages = await prisma.pipelineStage.findMany({
            where: { pipelineId: deal.pipelineId },
          });
          const stage =
            stages.find((s) => s.name.toLowerCase() === norm) ??
            stages.find((s) => s.name.toLowerCase().includes(norm));
          stageId = stage?.id;
        }
        if (!stageId) return { type: action.type, ok: false, message: 'Estágio não encontrado' };
        const stage = await prisma.pipelineStage.findFirst({
          where: { id: stageId, pipelineId: deal.pipelineId },
        });
        if (!stage) return { type: action.type, ok: false, message: 'Estágio inválido' };
        await prisma.deal.update({
          where: { id: dealId },
          data: {
            stageId,
            status: stage.isWon ? 'WON' : stage.isLost ? 'LOST' : deal.status,
            closedAt: stage.isWon || stage.isLost ? new Date() : null,
          },
        });
        return { type: action.type, ok: true, message: `Movido para ${stage.name}` };
      }

      case 'CREATE_TASK': {
        const dealId = config.dealId ? String(config.dealId) : ctx.deal?.id;
        const dueHours = Number(config.dueInHours ?? 24);
        await prisma.task.create({
          data: {
            companyId,
            title: String(config.title ?? 'Follow-up automação'),
            dealId,
            dueAt: new Date(Date.now() + dueHours * 3600000),
            status: 'PENDING',
          },
        });
        return { type: action.type, ok: true, message: 'Tarefa criada' };
      }

      case 'APPLY_TAG': {
        const dealId = String(config.dealId ?? ctx.deal?.id ?? '');
        const tagName = String(config.tagName ?? '').trim();
        if (!dealId || !tagName) return { type: action.type, ok: false, message: 'deal/tag obrigatório' };
        let tag = await prisma.tag.findFirst({
          where: { companyId, name: { equals: tagName, mode: 'insensitive' } },
        });
        if (!tag) tag = await prisma.tag.create({ data: { companyId, name: tagName } });
        await prisma.dealTag.upsert({
          where: { dealId_tagId: { dealId, tagId: tag.id } },
          create: { dealId, tagId: tag.id },
          update: {},
        });
        return { type: action.type, ok: true, message: `Tag ${tag.name}` };
      }

      case 'SEND_N8N_WEBHOOK': {
        await addQueue(QUEUES.SEND_TO_N8N, {
          companyId,
          event: String(config.event ?? 'automation.action'),
          data: { context: ctx, config },
        });
        return { type: action.type, ok: true, message: 'n8n enfileirado' };
      }

      case 'CREATE_SUMMARY': {
        if (!convId) return { type: action.type, ok: false, message: 'Sem conversa' };
        await addQueue(QUEUES.SUMMARIZE_CONVERSATION, {
          conversationId: convId,
          companyId,
        });
        return { type: action.type, ok: true, message: 'Resumo enfileirado' };
      }

      case 'CREATE_FUTURE_EVENT': {
        const dueHours = Number(config.dueInHours ?? 24);
        const dueAt = config.dueAt
          ? new Date(String(config.dueAt))
          : new Date(Date.now() + dueHours * 3600000);
        await prisma.task.create({
          data: {
            companyId,
            title: String(config.title ?? 'Compromisso automação'),
            description: config.description ? String(config.description) : undefined,
            dealId: config.dealId ? String(config.dealId) : ctx.deal?.id,
            conversationId: convId,
            dueAt,
            durationMinutes: Number(config.durationMinutes ?? 60),
            kind: 'APPOINTMENT',
            status: 'PENDING',
          },
        });
        return { type: action.type, ok: true, message: 'Compromisso agendado' };
      }

      default:
        return { type: action.type, ok: false, message: `Ação não implementada: ${action.type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro';
    return { type: action.type, ok: false, message: msg };
  }
}
