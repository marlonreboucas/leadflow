import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type PlanLimits = {
  maxMessagesMonth?: number;
  maxInstances?: number;
  maxAiAgents?: number;
  maxUsers?: number;
};

@Injectable()
export class UsageLimiterService {
  constructor(private readonly prisma: PrismaService) {}

  private currentPeriod() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  async assertCanSendMessage(companyId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub || sub.status === 'CANCELED' || sub.status === 'PAST_DUE') {
      throw new ForbiddenException('Assinatura inativa. Atualize seu plano.');
    }
    const limits = (sub.plan.limits ?? {}) as PlanLimits;
    const max = limits.maxMessagesMonth;
    if (!max) return;

    const period = this.currentPeriod();
    const usage = await this.prisma.usageLimit.findUnique({
      where: { companyId_metric_period: { companyId, metric: 'messages', period } },
    });
    const current = usage?.used ?? 0;
    if (current >= max) {
      throw new ForbiddenException(
        `Limite de ${max} mensagens/mês atingido. Faça upgrade do plano.`,
      );
    }
  }

  private async planLimits(companyId: string): Promise<PlanLimits> {
    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    return (sub?.plan.limits ?? {}) as PlanLimits;
  }

  async assertCanCreateInstance(companyId: string) {
    const limits = await this.planLimits(companyId);
    const max = limits.maxInstances;
    if (!max) return;
    const count = await this.prisma.whatsappInstance.count({ where: { companyId } });
    if (count >= max) {
      throw new ForbiddenException(`Limite de ${max} instância(s) WhatsApp do plano.`);
    }
  }

  async assertCanCreateAgent(companyId: string) {
    const limits = await this.planLimits(companyId);
    const max = limits.maxAiAgents;
    if (!max) return;
    const count = await this.prisma.aiAgent.count({ where: { companyId, isActive: true } });
    if (count >= max) {
      throw new ForbiddenException(`Limite de ${max} agente(s) IA do plano.`);
    }
  }

  async assertCanInviteUser(companyId: string) {
    const limits = await this.planLimits(companyId);
    const max = limits.maxUsers;
    if (!max) return;
    const members = await this.prisma.companyUser.count({ where: { companyId } });
    const pending = await this.prisma.invite.count({
      where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (members + pending >= max) {
      throw new ForbiddenException(`Limite de ${max} usuário(s) do plano.`);
    }
  }

  async incrementMessages(companyId: string) {
    const period = this.currentPeriod();
    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    const max = ((sub?.plan.limits ?? {}) as PlanLimits).maxMessagesMonth ?? 999_999;

    await this.prisma.usageLimit.upsert({
      where: { companyId_metric_period: { companyId, metric: 'messages', period } },
      create: { companyId, metric: 'messages', period, used: 1, limit: max },
      update: { used: { increment: 1 } },
    });
  }
}
