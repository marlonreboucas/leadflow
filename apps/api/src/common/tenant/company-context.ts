import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  companyId: string;
  userId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export const CompanyContext = {
  run<T>(ctx: TenantContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): TenantContext | undefined {
    return storage.getStore();
  },
  require(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) {
      throw new Error('TenantContext ausente — endpoint precisa estar autenticado');
    }
    return ctx;
  },
};
