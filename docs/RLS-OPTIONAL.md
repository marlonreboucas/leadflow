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

## Lado da aplicação (implementado, opt-in)

- **Flag `DB_RLS`** (env, padrão `false`): com `false` nada muda (sem custo); com `true`,
  ativa o wiring global abaixo.
- **Wiring global** — `TenantTransactionInterceptor` (registrado após o `TenantInterceptor`):
  quando `DB_RLS=true` e o request tem tenant, abre uma transação, seta `app.company_id` e
  executa o handler dentro dela. O `PrismaService` é um Proxy que roteia `prisma.<model>`
  para a transação ativa (via AsyncLocalStorage), de modo que **nenhum serviço precisa mudar**.
- **`PrismaService.runWithTenant(companyId, fn)`**: helper explícito; reaproveita a transação
  ativa se houver, ou abre uma quando `DB_RLS=true`.
- **`DB_RLS_TX_TIMEOUT_MS`** (padrão 15000): timeout da transação por request.

### Como ligar (staging primeiro)

```bash
psql "$DATABASE_URL" -f scripts/enable-rls.sql   # aplica policies (FORCE RLS)
# no .env do ambiente:
DB_RLS=true
```

### Cuidados / limitações conhecidas (validar em staging)

- **IO externo longo dentro do handler** (geração de IA, envio WhatsApp) roda dentro da
  transação → pode estourar `DB_RLS_TX_TIMEOUT_MS` e segura uma conexão. Idealmente, mova
  esse trabalho para fora do request (filas) ou aumente o timeout.
- **`$transaction` aninhado**: `companies.service` (criar filial) abre seu próprio
  `$transaction`; sob RLS global isso roda numa conexão sem `app.company_id` e será bloqueado.
  Ajustar para `runWithTenant`/reuso da transação ativa antes de habilitar.
- **Streaming/SSE/WebSocket**: o interceptor materializa a resposta (`lastValueFrom`); não use
  em respostas em streaming.
- **Role de conexão**: como o script usa `FORCE ROW LEVEL SECURITY`, vale inclusive para o
  dono — mas confirme que a connection string da API/worker não usa superuser com BYPASSRLS.

## Recomendação

Habilitar **apenas após** validar em staging que API **e** workers setam `app.company_id`
em todas as conexões de escrita/leitura. Até lá, o isolamento na aplicação é a barreira ativa.
