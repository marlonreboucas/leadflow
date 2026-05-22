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
| **Stripe** | `STRIPE_SECRET_KEY` | Cobrança real; sem isso o checkout em `/billing` ativa plano em modo dev |
| **Domínio / HTTPS** | `APP_URL`, `NEXT_PUBLIC_API_URL` | Produção: `https://app...` e `https://api...` |

---

## n8n — resumo

1. Suba **sua** instância n8n (cloud ou self-hosted).
2. Crie workflow com nó **Webhook** (POST).
3. No LeadFlow: **Integrações → n8n** → cadastre URL + eventos (`lead.created`, etc.).
4. Entrada n8n → LeadFlow: `POST /api/n8n/inbound/{companyId}/{slug}` com header `X-LeadFlow-Signature` (ver [AUTOMACOES-N8N.md](./AUTOMACOES-N8N.md)).

**Inbox e agente IA não dependem de n8n.**

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
