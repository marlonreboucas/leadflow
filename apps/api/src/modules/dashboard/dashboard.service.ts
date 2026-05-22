import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(companyId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const openConversationStatuses = [
      'NEW',
      'IN_PROGRESS',
      'WITH_AI',
      'WAITING_HUMAN',
      'WAITING_CUSTOMER',
    ] as const;

    const defaultPipeline = await this.prisma.pipeline.findFirst({
      where: { companyId, isDefault: true },
      select: { id: true },
    });

    const [
      conversationsOpen,
      unreadMessages,
      dealsOpen,
      dealsNewToday,
      tasksPending,
      tasksOverdue,
      agentsActive,
      whatsappInstances,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: { companyId, status: { in: [...openConversationStatuses] } },
      }),
      this.prisma.conversation.aggregate({
        where: { companyId },
        _sum: { unreadCount: true },
      }),
      this.prisma.deal.count({
        where: { companyId, status: 'OPEN' },
      }),
      this.prisma.deal.count({
        where: { companyId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.task.count({
        where: { companyId, status: { in: ['PENDING', 'DOING'] } },
      }),
      this.prisma.task.count({
        where: {
          companyId,
          status: { in: ['PENDING', 'DOING'] },
          dueAt: { lt: new Date() },
        },
      }),
      this.prisma.aiAgent.count({
        where: { companyId, isActive: true },
      }),
      this.prisma.whatsappInstance.findMany({
        where: { companyId },
        select: { id: true, status: true, phoneNumber: true },
      }),
    ]);

    let forecastWeightedCents = 0;
    let wonThisMonthValueCents = 0;
    if (defaultPipeline) {
      const openDeals = await this.prisma.deal.findMany({
        where: { companyId, pipelineId: defaultPipeline.id, status: 'OPEN' },
        select: { valueCents: true, stage: { select: { winProbability: true, isWon: true, isLost: true, position: true } } },
      });
      const openStages = await this.prisma.pipelineStage.findMany({
        where: { pipelineId: defaultPipeline.id, isWon: false, isLost: false },
        orderBy: { position: 'asc' },
      });
      const prob = (stage: (typeof openDeals)[0]['stage']) => {
        if (stage.winProbability != null) return stage.winProbability / 100;
        const idx = openStages.findIndex((s) => s.position === stage.position);
        if (idx < 0 || openStages.length <= 1) return 0.5;
        return (10 + (idx / (openStages.length - 1)) * 70) / 100;
      };
      forecastWeightedCents = openDeals.reduce(
        (s, d) => s + Math.round(d.valueCents * prob(d.stage)),
        0,
      );
      const wonAgg = await this.prisma.deal.aggregate({
        where: {
          companyId,
          status: 'WON',
          closedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { valueCents: true },
      });
      wonThisMonthValueCents = wonAgg._sum.valueCents ?? 0;
    }

    return {
      conversationsOpen,
      unreadMessages: unreadMessages._sum.unreadCount ?? 0,
      dealsOpen,
      dealsNewToday,
      tasksPending,
      tasksOverdue,
      agentsActive,
      whatsappConnected: whatsappInstances.filter((i) => i.status === 'CONNECTED').length,
      whatsappTotal: whatsappInstances.length,
      forecastWeightedCents,
      wonThisMonthValueCents,
      defaultPipelineId: defaultPipeline?.id ?? null,
    };
  }
}
