# RLS Postgres (opcional — defesa em profundidade)

O LeadFlow já isola tenants na **aplicação**: todas as queries filtram por `companyId`,
o `TenantInterceptor` propaga o contexto (`CompanyContext`, AsyncLocalStorage) e os
`tenant-guards` validam FKs cross-company. RLS adiciona uma **segunda barreira no banco**
— mesmo um bug de query não vaza dados de outra empresa.

> ⚠️ **Não habilitado por padrão.** Ligar RLS sem cumprir os pré-requisitos abaixo
> faz **todas as queries retornarem vazio** (ou falharem). Por isso o SQL aqui **não**
> é uma migration automática: aplique manualmente, com janela de manutenção.

## Pré-requisitos (decisões de infraestrutura)

1. **Role dedicado sem BYPASSRLS.** O dono da tabela e superusers ignoram RLS. A API
   precisa conectar com um role comum **e** as tabelas usarem `FORCE ROW LEVEL SECURITY`
   (para valer inclusive ao dono), ou a API conecta com um role que não seja dono.
2. **`app.company_id` por conexão.** Como o Prisma usa pool de conexões, o valor precisa
   ser setado **por transação** (`SET LOCAL`), não por sessão — senão uma conexão
   reutilizada carrega o tenant anterior.
3. **Workers/filas** também precisam setar `app.company_id` nas conexões de escrita.

## SQL (aplicar manualmente como superuser)

Script pronto e idempotente: **`scripts/enable-rls.sql`** (cobre as tabelas com `companyId`,
usa `FORCE ROW LEVEL SECURITY` e cria a policy `tenant_isolation`).

```bash
psql "$DATABASE_URL" -f scripts/enable-rls.sql
```

## Lado da aplicação (já disponível, opt-in)

- **Flag `DB_RLS`** (env, padrão `false`): com `false`, nada muda; com `true`, o wrapper
  passa a abrir transação e setar o tenant.
- **`PrismaService.runWithTenant(companyId, fn)`**: executa `fn` numa transação com
  `set_config('app.company_id', companyId, true)` (parametrizado, escopo da transação).
  Quando `DB_RLS=false`, só roda `fn` com o client normal (sem custo).

```ts
return this.prisma.runWithTenant(companyId, (tx) => tx.deal.findMany());
```

**Pendente de decisão (wiring global):** adotar `runWithTenant` em todo o caminho de request
(via interceptor lendo `CompanyContext`) tem custo de 1 transação por request e cuidados com
timeout de transação interativa e respostas em streaming/websocket. Recomenda-se migrar os
serviços de forma incremental e validar em **staging** antes de `DB_RLS=true` em produção.

## Recomendação

Habilitar **apenas após** validar em staging que API **e** workers setam `app.company_id`
em todas as conexões de escrita/leitura. Até lá, o isolamento na aplicação é a barreira ativa.
