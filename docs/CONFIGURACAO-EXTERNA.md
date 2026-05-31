# O que configurar fora do LeadFlow (servidor / contas externas)

Tudo abaixo roda **fora** do repositório. O app já está pronto para consumir via `.env`.

**Visão geral do sistema desenvolvido:** [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md)

---

## Obrigatório para produção

| Serviço | Variável `.env` | O que fazer |
|---------|-----------------|-------------|
| **PostgreSQL** | `DATABASE_URL` | Banco gerenciado (RDS, Supabase, Neon…) ou VPS com Postgres 15+ |
| **Redis** | `REDIS_URL` | Redis 7+ (Upstash, ElastiCache, container Docker) |
| **Evolution API** | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | VPS/Docker com Evolution v2.3.7+; QR para conectar WhatsApp |
| **Webhook público** | `WEBHOOK_PUBLIC_URL` | URL que a Evolution alcança (ex.: `https://api.seudominio.com` ou `http://host.docker.internal:3001` em dev Windows) |
| **OpenAI** | `OPENAI_API_KEY` | Conta OpenAI com créditos — IA e embeddings |
| **JWT** | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Strings longas aleatórias (nunca commitar) |

---

## Opcional (integrações)

| Serviço | Variável | Quando usar |
|---------|----------|-------------|
| **n8n** (servidor seu) | — | Só se quiser workflows externos. No LeadFlow: `/integrations/n8n` cadastra URL do webhook n8n. **Não precisa** para Inbox/IA funcionar. |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Cobrança real; sem isso o checkout em `/billing` ativa plano em modo dev. Ver [seção Stripe](#stripe--cobrança) |
| **Domínio / HTTPS** | `APP_URL`, `NEXT_PUBLIC_API_URL` | Produção: `https://app...` e `https://api...` |

---

## n8n — resumo

1. Suba **sua** instância n8n (cloud ou self-hosted).
2. Crie workflow com nó **Webhook** (POST).
3. No LeadFlow: **Integrações → n8n** → cadastre URL + eventos (`lead.created`, etc.).
4. Entrada n8n → LeadFlow: `POST /api/n8n/inbound/{companyId}/{slug}` com header `X-LeadFlow-Signature` (ver [AUTOMACOES-N8N.md](./AUTOMACOES-N8N.md)).

**Inbox e agente IA não dependem de n8n.**

---

## Stripe — cobrança

Sem `STRIPE_SECRET_KEY`, o checkout em `/billing` ativa o plano em **modo dev** (sem pagamento). Para cobrança real:

1. **Chaves** — `STRIPE_SECRET_KEY` em [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) (use chave de teste em dev).
2. **Produtos/Preços** — crie um *Price* recorrente para cada plano e salve o `price_id` em `Plan.limits.stripePriceId` (no seed ou via admin). O checkout só usa o Stripe quando o plano tem `stripePriceId`.
3. **Webhook** — em **Developers → Webhooks → Add endpoint**:
   - URL: `https://api.seudominio.com/webhooks/stripe` (rota pública, fora do prefixo `/api`).
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Copie o **Signing secret** (`whsec_...`) para `STRIPE_WEBHOOK_SECRET`.
4. **Em dev** — use o [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3001/webhooks/stripe` (ele imprime o `whsec_` a usar).

**Fluxo:** checkout → pagamento → `checkout.session.completed` ativa a `Subscription` (status `ACTIVE`, `externalId` = id da subscription Stripe). Atualizações/cancelamentos chegam por `customer.subscription.updated/deleted`; falha de fatura marca `PAST_DUE`. A assinatura do webhook é validada via HMAC-SHA256 com tolerância de 5 min contra replay.

---

## Deploy na Hostinger VPS

Guia completo: **[DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md)** (Docker, Caddy, DNS, WhatsApp, migrations).

---

## Checklist pós-deploy

```bash
pnpm db:migrate
pnpm db:seed          # só dev/demo
curl http://localhost:3001/health/ready
```

- [ ] Evolution conectada (`/whatsapp` → QR → Sincronizar webhook)
- [ ] Agente IA `FULL_AUTO` + `OPENAI_API_KEY`
- [ ] Teste mensagem: login `demo@leadflow.ai` / `demo1234`

---

## O que **não** precisa configurar externamente

- Motor de automações, filas BullMQ, calendário/agendamentos — rodam no monorepo (API + worker).
- Relatórios, auditoria, rate limit — usam Postgres + Redis já listados acima.

Ver também: [AGENDAMENTO-CALENDARIO.md](./AGENDAMENTO-CALENDARIO.md)
