import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscription: { include: { plan: true } },
        usage: true,
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPriceCents: 'asc' },
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
      },
      subscription: company.subscription,
      usage: company.usage,
      plans,
    };
  }
}
