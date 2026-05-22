import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelinesService } from '../pipelines/pipelines.service';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelines: PipelinesService,
  ) {}

  async getMine(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscription: { include: { plan: true } },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async updateMine(
    companyId: string,
    data: Partial<{
      name: string;
      segment: string;
      timezone: string;
      businessHours: Prisma.InputJsonValue;
      defaultGreeting: string;
    }>,
  ) {
    return this.prisma.company.update({
      where: { id: companyId },
      data,
    });
  }

  async createChildAgency(parentId: string, input: { name: string }) {
    const parent = await this.prisma.company.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Empresa não encontrada');
    if (parent.parentId) {
      throw new BadRequestException('Apenas empresas raiz podem criar filiais');
    }

    const slug = await this.uniqueSlug(input.name);
    const starter = await this.prisma.plan.findUniqueOrThrow({ where: { slug: 'starter' } });

    return this.prisma.$transaction(async (tx) => {
      const child = await tx.company.create({
        data: {
          name: input.name,
          slug,
          parentId,
          status: 'TRIAL',
          timezone: parent.timezone,
        },
      });
      await tx.subscription.create({
        data: {
          companyId: child.id,
          planId: starter.id,
          provider: 'MANUAL',
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 3600000),
        },
      });
      await this.pipelines.createDefault(child.id, tx);
      return child;
    });
  }

  private async uniqueSlug(name: string) {
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 36) || 'filial';
    for (let i = 0; i < 50; i++) {
      const slug = i === 0 ? base : `${base}-${i}`;
      if (!(await this.prisma.company.findUnique({ where: { slug } }))) return slug;
    }
    throw new BadRequestException('Não foi possível gerar slug');
  }
}
