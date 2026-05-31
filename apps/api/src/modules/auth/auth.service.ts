import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import { env } from '../../config/env';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly pipelines: PipelinesService,
  ) {}

  async signup(input: { name: string; email: string; password: string; companyName: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email já cadastrado');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const slug = await this.uniqueSlug(input.companyName);

    const ownerRole = await this.prisma.role.findFirstOrThrow({
      where: { companyId: null, slug: 'OWNER' },
    });

    const starter = await this.prisma.plan.findUniqueOrThrow({ where: { slug: 'starter' } });

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, passwordHash, name: input.name },
      });

      const company = await tx.company.create({
        data: {
          name: input.companyName,
          slug,
          status: 'TRIAL',
          timezone: 'America/Sao_Paulo',
        },
      });

      await tx.companyUser.create({
        data: { companyId: company.id, userId: user.id, roleId: ownerRole.id },
      });

      await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: starter.id,
          provider: 'MANUAL',
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastActiveCompanyId: company.id },
      });

      await this.pipelines.createDefault(company.id, tx);

      return { user, company };
    });

    return this.issueTokens({
      userId: result.user.id,
      email: result.user.email,
      companyId: result.company.id,
      roleSlug: 'OWNER',
      tokenVersion: result.user.tokenVersion,
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { companies: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const memberships = user.companies.filter((c) => c.isActive);
    if (memberships.length === 0) {
      throw new UnauthorizedException('Usuário sem empresa associada');
    }
    const active =
      memberships.find((c) => c.companyId === user.lastActiveCompanyId) ?? memberships[0];
    if (!active?.role) {
      throw new UnauthorizedException(
        'Perfil de acesso não configurado. Rode o seed ou crie a conta em /signup.',
      );
    }

    return this.issueTokens({
      userId: user.id,
      email: user.email,
      companyId: active.companyId,
      roleSlug: active.role.slug,
      tokenVersion: user.tokenVersion,
    });
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Recarrega do banco: revogação (tokenVersion) e permissões atuais valem aqui também.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        companies: { where: { companyId: payload.companyId, isActive: true }, include: { role: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Refresh token inválido');
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Sessão revogada. Faça login novamente.');
    }
    const membership = user.companies[0];
    if (!membership?.role) throw new UnauthorizedException('Sem acesso a esta empresa');

    return this.issueTokens({
      userId: user.id,
      email: user.email,
      companyId: membership.companyId,
      roleSlug: membership.role.slug,
      tokenVersion: user.tokenVersion,
    });
  }

  /** Revoga todas as sessões do usuário (logout em todos os dispositivos). */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { ok: true };
  }

  /** Troca de senha: valida a atual, revoga outras sessões e reemite a atual. */
  async changePassword(
    userId: string,
    companyId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Senha atual incorreta');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    const membership = await this.prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { role: true },
    });
    if (!membership?.role) throw new UnauthorizedException('Sem acesso a esta empresa');

    return this.issueTokens({
      userId,
      email: updated.email,
      companyId,
      roleSlug: membership.role.slug,
      tokenVersion: updated.tokenVersion,
    });
  }

  async acceptInvite(input: {
    token: string;
    name?: string;
    password?: string;
  }) {
    const invite = await this.prisma.invite.findUnique({ where: { token: input.token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Convite inválido ou expirado');
    }

    let user = await this.prisma.user.findUnique({ where: { email: invite.email } });

    if (!user) {
      if (!input.password || input.password.length < 6) {
        throw new BadRequestException('Senha obrigatória (mín. 6 caracteres) para novo usuário');
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      user = await this.prisma.user.create({
        data: {
          email: invite.email,
          name: input.name?.trim() || invite.email.split('@')[0],
          passwordHash,
        },
      });
    }

    const exists = await this.prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: invite.companyId, userId: user.id } },
    });
    if (!exists) {
      await this.prisma.companyUser.create({
        data: {
          companyId: invite.companyId,
          userId: user.id,
          roleId: invite.roleId,
          invitedBy: invite.issuedById,
        },
      });
    }

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveCompanyId: invite.companyId },
    });

    const membership = await this.prisma.companyUser.findUniqueOrThrow({
      where: { companyId_userId: { companyId: invite.companyId, userId: user.id } },
      include: { role: true },
    });

    return this.issueTokens({
      userId: user.id,
      email: user.email,
      companyId: invite.companyId,
      roleSlug: membership.role.slug,
      tokenVersion: user.tokenVersion,
    });
  }

  async switchCompany(userId: string, companyId: string) {
    const membership = await this.prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { user: true, role: true },
    });
    if (!membership || !membership.isActive) {
      throw new UnauthorizedException('Usuário não pertence a esta empresa');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveCompanyId: companyId },
    });

    return this.issueTokens({
      userId,
      email: membership.user.email,
      companyId,
      roleSlug: membership.role.slug,
      tokenVersion: membership.user.tokenVersion,
    });
  }

  private async issueTokens(input: {
    userId: string;
    email: string;
    companyId: string;
    roleSlug: string;
    tokenVersion: number;
  }) {
    const payload = {
      sub: input.userId,
      email: input.email,
      companyId: input.companyId,
      tv: input.tokenVersion,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN }),
      this.jwt.signAsync(payload, { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_EXPIRES_IN }),
    ]);
    return {
      accessToken,
      refreshToken,
      user: {
        id: input.userId,
        email: input.email,
        companyId: input.companyId,
        roleSlug: input.roleSlug,
      },
    };
  }

  private async uniqueSlug(name: string) {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      // strip combining diacritics (U+0300 – U+036F)
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'empresa';
    for (let i = 0; i < 50; i++) {
      const slug = i === 0 ? base : `${base}-${i}`;
      const exists = await this.prisma.company.findUnique({ where: { slug } });
      if (!exists) return slug;
    }
    throw new BadRequestException('Não foi possível gerar slug único para a empresa');
  }
}
