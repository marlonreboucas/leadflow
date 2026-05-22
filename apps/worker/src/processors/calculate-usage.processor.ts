import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';

const prisma = new PrismaClient();

type UsageJob = { companyId?: string };

export async function processCalculateUsage(job: Job<UsageJob>) {
  const period = currentPeriod();
  const companies = job.data.companyId
    ? [{ id: job.data.companyId }]
    : await prisma.company.findMany({ select: { id: true } });

  for (const { id: companyId } of companies) {
    const count = await prisma.message.count({
      where: {
        companyId,
        direction: 'OUTBOUND',
        createdAt: { gte: periodStart(period) },
      },
    });
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    const max =
      ((sub?.plan.limits ?? {}) as { maxMessagesMonth?: number }).maxMessagesMonth ?? 999_999;

    await prisma.usageLimit.upsert({
      where: { companyId_metric_period: { companyId, metric: 'messages', period } },
      create: { companyId, metric: 'messages', period, used: count, limit: max },
      update: { used: count, limit: max },
    });
  }
}

function currentPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodStart(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}
