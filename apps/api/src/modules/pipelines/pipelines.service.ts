import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_STAGES = [
  { name: 'Novo lead', position: 0, color: '#94a3b8', winProbability: 5 },
  { name: 'Qualificação', position: 1, color: '#60a5fa', winProbability: 15 },
  { name: 'Diagnóstico', position: 2, color: '#a78bfa', winProbability: 35 },
  { name: 'Proposta', position: 3, color: '#f59e0b', winProbability: 60 },
  { name: 'Negociação', position: 4, color: '#f97316', winProbability: 80 },
  { name: 'Ganho', position: 5, color: '#22c55e', isWon: true, winProbability: 100 },
  { name: 'Perdido', position: 6, color: '#ef4444', isLost: true, winProbability: 0 },
];

type PrismaLike = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.pipeline.findMany({
      where: { companyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        stages: { orderBy: { position: 'asc' } },
      },
    });
  }

  async createDefault(companyId: string, client: PrismaLike = this.prisma) {
    const pipeline = await client.pipeline.create({
      data: {
        companyId,
        name: 'Funil principal',
        isDefault: true,
        position: 0,
        stages: {
          create: DEFAULT_STAGES.map((s) => ({
            name: s.name,
            position: s.position,
            color: s.color,
            isWon: s.isWon ?? false,
            isLost: s.isLost ?? false,
            winProbability: s.winProbability ?? null,
          })),
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    return pipeline;
  }

  /** Forecast = soma valor × probabilidade da etapa (deals OPEN). */
  async getForecast(companyId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, companyId },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    if (!pipeline) return null;

    const openStages = pipeline.stages.filter((s) => !s.isWon && !s.isLost);
    const probForStage = (stage: (typeof pipeline.stages)[0]) => {
      if (stage.winProbability != null) return stage.winProbability;
      const idx = openStages.findIndex((s) => s.id === stage.id);
      if (idx < 0) return stage.isWon ? 100 : 0;
      if (openStages.length <= 1) return 50;
      return Math.round(10 + (idx / (openStages.length - 1)) * 70);
    };

    const deals = await this.prisma.deal.findMany({
      where: { companyId, pipelineId, status: 'OPEN' },
      select: { id: true, valueCents: true, stageId: true },
    });

    const wonThisMonth = await this.prisma.deal.aggregate({
      where: {
        companyId,
        pipelineId,
        status: 'WON',
        closedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { valueCents: true },
      _count: true,
    });

    let totalOpenValue = 0;
    let weightedForecast = 0;
    const byStage = pipeline.stages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stageId === stage.id);
      const stageValue = stageDeals.reduce((s, d) => s + d.valueCents, 0);
      totalOpenValue += stageValue;
      const prob = probForStage(stage) / 100;
      const weighted = Math.round(stageValue * prob);
      if (!stage.isWon && !stage.isLost) weightedForecast += weighted;
      return {
        stageId: stage.id,
        stageName: stage.name,
        position: stage.position,
        isWon: stage.isWon,
        isLost: stage.isLost,
        winProbability: probForStage(stage),
        dealCount: stageDeals.length,
        totalValueCents: stageValue,
        weightedValueCents: weighted,
      };
    });

    return {
      pipelineId,
      pipelineName: pipeline.name,
      totalOpenValue,
      weightedForecast,
      openDealCount: deals.length,
      wonThisMonthCount: wonThisMonth._count,
      wonThisMonthValueCents: wonThisMonth._sum.valueCents ?? 0,
      byStage,
    };
  }
}
