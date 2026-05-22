import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditAction } from '@prisma/client';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SKIP_PREFIXES = ['/api/auth', '/webhooks', '/health', '/api/n8n/inbound'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const method = String(req.method ?? 'GET').toUpperCase();
    const path = String(req.originalUrl ?? req.url ?? '');

    if (!MUTATING.has(method) || SKIP_PREFIXES.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    const user = req.user as { companyId?: string; userId?: string } | undefined;
    if (!user?.companyId) return next.handle();

    const action = methodToAction(method);
    const entity = pathToEntity(path);

    return next.handle().pipe(
      tap(() => {
        void this.prisma.auditLog
          .create({
            data: {
              companyId: user.companyId,
              userId: user.userId,
              action,
              entity,
              entityId: extractEntityId(path),
              diff: sanitizeBody(req.body),
              ip: req.ip,
              userAgent: req.headers?.['user-agent'] as string | undefined,
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}

function methodToAction(method: string): AuditAction {
  if (method === 'POST') return 'CREATE';
  if (method === 'DELETE') return 'DELETE';
  return 'UPDATE';
}

function pathToEntity(path: string): string {
  const clean = path.replace(/^\/api\//, '').split('?')[0] ?? '';
  const segment = clean.split('/').filter(Boolean)[0];
  return segment || 'unknown';
}

function extractEntityId(path: string): string | undefined {
  const parts = path.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && /^[a-z0-9]{20,}$/i.test(last)) return last;
  return undefined;
}

function sanitizeBody(body: unknown): object | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const copy = { ...(body as Record<string, unknown>) };
  for (const key of ['password', 'token', 'secret', 'refreshToken']) {
    if (key in copy) copy[key] = '[redacted]';
  }
  return copy;
}
