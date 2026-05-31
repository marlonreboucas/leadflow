import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient, Prisma } from '@leadflow/database';
import { env } from '../config/env';

/**
 * Guarda a transação de tenant ativa do request atual. Quando presente, o
 * PrismaService (via Proxy) roteia as queries para ela, fazendo valer as
 * policies de RLS (app.company_id setado por `SET LOCAL`).
 */
const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Abre uma transação com `app.company_id` setado e executa `fn` dentro do
   * escopo do ALS, de modo que todo acesso a `prisma.<model>` durante `fn`
   * caia na mesma conexão/transação (necessário para RLS com pool).
   */
  async runInTenantTransaction<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
    return this.$transaction(
      async (tx) => {
        // set_config parametrizado (anti-injeção); `true` = escopo da transação.
        await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`;
        return txStorage.run(tx, fn);
      },
      { timeout: env.DB_RLS_TX_TIMEOUT_MS, maxWait: 10_000 },
    );
  }

  /**
   * Helper explícito: roda `fn(tx)` com o tenant setado. Reaproveita a transação
   * ativa do request, se houver; com `DB_RLS=false` usa o client normal.
   */
  async runWithTenant<T>(
    companyId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const active = txStorage.getStore();
    if (active) return fn(active);
    if (!env.DB_RLS) return fn(this);
    return this.runInTenantTransaction(companyId, () => fn(txStorage.getStore() as Prisma.TransactionClient));
  }
}

/**
 * Envolve o PrismaService num Proxy: quando há transação de tenant ativa no
 * ALS, o acesso a modelos/queries é roteado para ela; caso contrário, usa o
 * client base. Sem transação ativa (ex.: DB_RLS=false), o overhead é só o get.
 */
export function createTenantAwarePrisma(): PrismaService {
  const base = new PrismaService();
  return new Proxy(base, {
    get(target, prop, receiver) {
      const tx = txStorage.getStore();
      if (tx && prop in tx) {
        const value = (tx as Record<string | symbol, unknown>)[prop];
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(tx) : value;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}
