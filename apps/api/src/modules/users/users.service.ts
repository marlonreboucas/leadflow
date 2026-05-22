import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCompany(companyId: string) {
    return this.prisma.companyUser.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        role: { select: { slug: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: {
          include: {
            company: { select: { id: true, name: true, slug: true } },
            role: { select: { slug: true, name: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      lastActiveCompanyId: user.lastActiveCompanyId,
      memberships: user.companies.map((cu) => ({
        companyId: cu.companyId,
        companyName: cu.company.name,
        companySlug: cu.company.slug,
        roleSlug: cu.role.slug,
        roleName: cu.role.name,
      })),
    };
  }
}
