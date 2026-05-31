import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@leadflow/database';
import { env } from '../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executa `fn` dentro de uma transação com `app.company_id` setado por
   * `SET LOCAL`, habilitando as policies de RLS no Postgres (defesa em
   * profundidade). Quando `DB_RLS` está desligado (padrão), apenas executa a
   * função com o client normal — sem custo de transação.
   *
   * Adote este wrapper de forma deliberada (ver docs/RLS-OPTIONAL.md) antes de
   * ligar RLS em produção; o caminho global ainda exige validação em staging.
   */
  async runWithTenant<T>(
    companyId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!env.DB_RLS) {
      return fn(this);
    }
    return this.$transaction(async (tx) => {
      // set_config parametrizado evita injeção; `true` = escopo da transação.
      await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`;
      return fn(tx);
    });
  }
}
