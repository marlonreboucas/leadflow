# LeadFlow AI — Sistema pronto (checklist interno)

Tudo abaixo roda **no monorepo**. Configuração de servidor e contas: [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md) · Deploy: [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) · Doc completa: [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md).

---

## Status por fase (código entregue)

| Fase | Status | Rotas / módulos principais |
|------|--------|----------------------------|
| 0 Fundação | ✅ | Auth, RBAC, multi-tenant, Docker, seed |
| 1 WhatsApp | ✅ | `/inbox`, `/whatsapp`, webhooks Evolution |
| 2 CRM | ✅ | `/leads`, `/kanban`, `/tasks`, timeline, **forecast** |
| 2b Inbox CRM | ✅ | Painel deal, filtros, templates, ganho/perda |
| 3 IA | ✅ | `/agents`, RAG, tools, classify, SDR→Vendas |
| 4 Automações | ✅ | `/automations`, engine + worker + n8n (código) |
| 5 SaaS | ✅ | `/billing`, `/team`, limites, convites, agency |
| 6 Hardening | ✅ | `/reports`, `/logs`, health, audit, throttle Redis |
| 7 Calendário | ✅ | `/calendar`, `schedule_event`, lembretes, Google opcional |
| 7 Polimento | ✅ | Onboarding, templates, KB |
| Deploy | ✅ | `docker-compose.prod.yml`, Caddy, guia Hostinger |

---

## Filas worker (todas implementadas)

| Fila | Função |
|------|--------|
| process-incoming-message | Webhook → mensagem + automação + classify |
| send-whatsapp-message | Envio Evolution |
| run-ai-agent | OpenAI + tools |
| classify-lead | Temperatura + roteamento Vendas |
| summarize-conversation | Resumo IA |
| execute-automation | Motor de regras |
| send-to-n8n | Webhook outbound (se cadastrado) |
| sync-whatsapp-status | Status instância |
| process-media | Tipo mídia na mensagem |
| calculate-usage | Contadores mensagens |
| generate-reports | Pré-agregação leve |
| idle-lead-scanner | Lead parado |
| task-overdue-scanner | Tarefa atrasada |
| appointment-reminder-scanner | Lembrete compromisso |
| sync-google-calendar | Sync Google (se conectado) |
| index-knowledge-item | Embeddings KB |

---

## Telas Web (25 rotas)

Login, signup, dashboard, inbox, whatsapp, kanban, leads, tasks, calendar, agents, knowledge-base, automations, n8n, templates, reports, team, billing, settings, logs, invite.

Lista completa: [DOCUMENTACAO-COMPLETA.md §4](./DOCUMENTACAO-COMPLETA.md#4-telas-da-aplicação-web).

---

## Comandos para subir do zero (local)

```bash
pnpm docker:up
pnpm install
pnpm db:migrate:deploy
pnpm db:generate          # feche pnpm dev se EPERM no Windows (use db:generate:win)
pnpm db:seed
pnpm dev
pnpm validate:health
```

**Demo:** `demo@leadflow.ai` / `demo1234`

---

## URLs de validação rápida

| URL | Esperado |
|-----|----------|
| http://localhost:3000/login | Login OK |
| http://localhost:3000/dashboard | KPIs + forecast + onboarding |
| http://localhost:3000/inbox | Conversas + painel lead |
| http://localhost:3000/calendar | Calendário visual |
| http://localhost:3000/automations | Regras demo |
| http://localhost:3001/health/ready | postgres + redis ok |

---

## Produção (VPS)

```bash
cp docker/.env.production.example .env
nano .env && nano docker/Caddyfile
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d postgres redis
./scripts/vps-migrate.sh
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

Detalhes: [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md)

---

## Fora do escopo do código (você configura)

- VPS / deploy ([DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md))
- Evolution + QR WhatsApp em produção
- `OPENAI_API_KEY`
- n8n (opcional)
- Google Calendar OAuth (opcional)
- Stripe (opcional)
- GitHub / CI (opcional)
- RLS Postgres ([RLS-OPTIONAL.md](./RLS-OPTIONAL.md))

---

## Opcional futuro (não bloqueia MVP)

- Editor drag-and-drop de automações
- Asaas / Mercado Pago
- Swagger UI público
- App mobile inbox
