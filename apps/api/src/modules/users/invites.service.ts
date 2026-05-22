import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageLimiterService } from '../billing/usage-limiter.service';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: UsageLimiterService,
  ) {}

  async list(companyId: string) {
    return this.prisma.invite.findMany({
      where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        roleId: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async create(companyId: string, issuedById: string, input: { email: string; roleSlug: string }) {
    await this.limits.assertCanInviteUser(companyId);

    const email = input.email.trim().toLowerCase();
    const role = await this.prisma.role.findFirst({
      where: {
        OR: [
          { companyId, slug: input.roleSlug as never },
          { companyId: null, slug: input.roleSlug as never },
        ],
      },
    });
    if (!role) throw new BadRequestException('Perfil inválido');

    const existingMember = await this.prisma.user.findUnique({
      where: { email },
      include: { companies: { where: { companyId } } },
    });
    if (existingMember?.companies.length) {
      throw new ConflictException('Usuário já faz parte desta empresa');
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);

    return this.prisma.invite.create({
      data: {
        companyId,
        email,
        roleId: role.id,
        token,
        issuedById,
        expiresAt,
      },
      select: { id: true, email: true, token: true, expiresAt: true, roleId: true },
    });
  }

  async preview(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException('Convite inválido ou expirado');
    }
    const company = await this.prisma.company.findUnique({
      where: { id: invite.companyId },
      select: { name: true, slug: true },
    });
    return { email: invite.email, companyName: company?.name, expiresAt: invite.expiresAt };
  }
}
