import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyContext } from '../tenant/company-context';

/**
 * Quando RLS está ligado (DB_RLS=true), envolve o request numa transação com
 * `app.company_id` setado, ativando as policies do Postgres. Inerte quando
 * DB_RLS=false ou em rotas sem tenant (públicas). Deve rodar DEPOIS do
 * TenantInterceptor (que popula o CompanyContext).
 *
 * Cuidado: usa transação interativa — handlers com IO externo longo (IA, envio
 * WhatsApp) podem estourar o timeout. Validar em staging antes de produção.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!env.DB_RLS) return next.handle();
    const tenant = CompanyContext.get();
    if (!tenant?.companyId) return next.handle();

    return from(
      this.prisma.runInTenantTransaction(tenant.companyId, () => lastValueFrom(next.handle())),
    );
  }
}
