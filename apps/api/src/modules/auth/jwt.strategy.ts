import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  companyId: string;
  tv: number; // tokenVersion no momento da emissão
}

export interface AuthContext {
  userId: string;
  email: string;
  companyId: string;
  roleSlug: string;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  /**
   * Validação a cada request contra o banco:
   * - usuário existe e tokenVersion bate (senão: sessão revogada);
   * - membership na empresa do token existe e está ativa (senão: sem acesso);
   * - role + permissions são recarregadas do banco (mudanças valem na hora).
   */
  async validate(payload: JwtPayload): Promise<AuthContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        tokenVersion: true,
        companies: {
          where: { companyId: payload.companyId, isActive: true },
          select: {
            companyId: true,
            role: {
              select: {
                slug: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Sessão inválida');
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Sessão revogada. Faça login novamente.');
    }

    const membership = user.companies[0];
    if (!membership?.role) {
      throw new UnauthorizedException('Sem acesso a esta empresa');
    }

    return {
      userId: user.id,
      email: user.email,
      companyId: membership.companyId,
      roleSlug: membership.role.slug,
      permissions: membership.role.permissions.map((rp) => rp.permission.key),
    };
  }
}
