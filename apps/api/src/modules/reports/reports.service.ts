import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(companyId: string) {
    const since = new Date(Date.now() - 30 * 24 * 3600000);

    const [messagesByDay, dealsByStage, aiCosts, topAgents] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
        FROM "Message"
        WHERE "companyId" = ${companyId} AND "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.deal.groupBy({
        by: ['stageId'],
        where: { companyId, status: 'OPEN' },
        _count: true,
      }),
      this.prisma.aiAgentLog.aggregate({
        where: { companyId, createdAt: { gte: since } },
        _sum: { costCents: true, inputTokens: true, outputTokens: true },
        _count: true,
      }),
      this.prisma.aiAgentLog.groupBy({
        by: ['agentId'],
        where: { companyId, createdAt: { gte: since } },
        _sum: { costCents: true },
        _count: true,
      }),
    ]);

    const stages = await this.prisma.pipelineStage.findMany({
      where: { pipeline: { companyId } },
      select: { id: true, name: true },
    });
    const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]));

    return {
      messagesByDay: messagesByDay.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
      dealsByStage: dealsByStage.map((d) => ({
        stage: stageMap[d.stageId] ?? d.stageId,
        count: d._count,
      })),
      ai: {
        totalCostCents: aiCosts._sum.costCents ?? 0,
        runs: aiCosts._count,
        tokens: (aiCosts._sum.inputTokens ?? 0) + (aiCosts._sum.outputTokens ?? 0),
      },
      topAgents: topAgents
        .map((a) => ({
          agentId: a.agentId,
          runs: a._count,
          costCents: a._sum.costCents ?? 0,
        }))
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 5),
    };
  }
}
