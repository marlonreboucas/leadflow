import type { PrismaClient } from '@leadflow/database';

export type RouteAgentInput = {
  companyId: string;
  conversationId: string;
  temperature?: 'COLD' | 'WARM' | 'HOT' | null;
  stageName?: string | null;
};

/**
 * Roteia conversa de SDR → Vendas quando lead está quente ou em etapa avançada.
 */
export async function maybeRouteToSalesAgent(
  prisma: PrismaClient,
  input: RouteAgentInput,
): Promise<{ routed: boolean; salesAgentId?: string }> {
  const hot =
    input.temperature === 'HOT' ||
    /qualifica|proposta|negocia|fechamento/i.test(input.stageName ?? '');

  if (!hot) return { routed: false };

  const sales = await prisma.aiAgent.findFirst({
    where: { companyId: input.companyId, isActive: true, type: 'SALES' },
    orderBy: { createdAt: 'asc' },
  });
  if (!sales) return { routed: false };

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, companyId: input.companyId },
    include: { currentAgent: { select: { type: true } } },
  });
  if (!conversation || conversation.currentAgent?.type === 'SALES') {
    return { routed: false };
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { currentAgentId: sales.id },
  });

  return { routed: true, salesAgentId: sales.id };
}
