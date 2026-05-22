import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { PermissionKey } from '@leadflow/shared';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Não autenticado');

    const granted: string[] = user.permissions ?? [];
    const missing = required.filter((p) => !granted.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Permissão ausente: ${missing.join(', ')}`);
    }
    return true;
  }
}
