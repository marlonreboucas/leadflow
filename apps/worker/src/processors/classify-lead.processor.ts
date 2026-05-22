import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { maybeRouteToSalesAgent } from '@leadflow/ai-runtime';

const prisma = new PrismaClient();

type ClassifyJob = {
  companyId: string;
  dealId: string;
  messageBody: string;
};

function inferTemperature(text: string): 'COLD' | 'WARM' | 'HOT' {
  const t = text.toLowerCase();
  if (
    /orçamento|orcamento|contratar|fechar|comprar|quanto custa|preço|preco|plano|proposta|urgente/.test(
      t,
    )
  ) {
    return 'HOT';
  }
  if (/interessad|saber mais|informaç|gostaria|agendar|demo|teste/.test(t)) {
    return 'WARM';
  }
  return 'COLD';
}

export async function processClassifyLead(job: Job<ClassifyJob>) {
  const { companyId, dealId, messageBody } = job.data;
  if (!messageBody.trim()) return;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, companyId, status: 'OPEN' },
    include: { stage: true },
  });
  if (!deal) return;

  const temperature = inferTemperature(messageBody);
  if (deal.temperature !== temperature) {
    await prisma.deal.update({
      where: { id: dealId },
      data: { temperature },
    });
  }

  let conversationId = deal.conversationId;
  if (!conversationId) {
    const conv = await prisma.conversation.findFirst({
      where: { companyId, contactId: deal.contactId },
      orderBy: { updatedAt: 'desc' },
    });
    conversationId = conv?.id ?? null;
  }
  if (!conversationId) return;

  await maybeRouteToSalesAgent(prisma, {
    companyId,
    conversationId,
    temperature,
    stageName: deal.stage?.name,
  });
}
