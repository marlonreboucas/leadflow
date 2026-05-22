import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  ThrottlerModuleOptions,
  getOptionsToken,
  getStorageToken,
} from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Rate limit keyed by company (authenticated) or IP. Ignora rotas @Public() (login, webhooks). */
@Injectable()
export class CompanyThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { companyId?: string } | undefined;
    if (user?.companyId) return `company:${user.companyId}`;
    const ip = (req['ip'] as string) ?? (req['socket'] as { remoteAddress?: string })?.remoteAddress;
    return `ip:${ip ?? 'unknown'}`;
  }
}
