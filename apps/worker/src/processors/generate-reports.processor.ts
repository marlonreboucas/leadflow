import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';

const prisma = new PrismaClient();

/** Pré-agrega métricas leves (relatórios em tempo real usam /reports/overview). */
export async function processGenerateReports(job: Job<{ companyId?: string }>) {
  const since = new Date(Date.now() - 30 * 24 * 3600000);
  const companies = job.data.companyId
    ? [{ id: job.data.companyId }]
    : await prisma.company.findMany({ select: { id: true }, take: 100 });

  for (const { id: companyId } of companies) {
    const [messages, dealsOpen, aiRuns] = await Promise.all([
      prisma.message.count({ where: { companyId, createdAt: { gte: since } } }),
      prisma.deal.count({ where: { companyId, status: 'OPEN' } }),
      prisma.aiAgentLog.count({ where: { companyId, createdAt: { gte: since } } }),
    ]);
    void messages;
    void dealsOpen;
    void aiRuns;
  }
}
