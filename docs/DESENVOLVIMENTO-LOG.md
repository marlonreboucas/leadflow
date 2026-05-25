# Log de desenvolvimento — LeadFlow AI

**Status:** MVP interno **finalizado** (código). Próximo passo: **deploy VPS** (Hostinger) + contas externas.

**Documentação mestre:** [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md)

---

## Linha do tempo

| Período | Entrega |
|---------|---------|
| Fase 0 | Monorepo, Docker, auth, RBAC, Prisma, seed |
| Fase 1 | Evolution, webhook, inbox, socket, mensagens |
| Fase 2 | CRM kanban, leads, tasks, timeline |
| Fase 3 | Agentes IA, RAG, tools, classify, SDR→Vendas |
| Fase 4 | Motor automações, UI, n8n inbound/outbound |
| Fase 5 | Billing, convites, agency, limites |
| Fase 6 | Reports, audit, throttle Redis, health |
| Fase 7 | Calendário, Google opcional, onboarding |
| Polimento CRM | Inbox Pipedrive, forecast, filtros, templates |
| Deploy | `docker-compose.prod.yml`, Caddy, guia Hostinger |
| RebFlow prod | rebflow.com.br, Docker bookworm, CORS, serviço `evolution` — [DEPLOY-REBFLOW-PROD.md](./DEPLOY-REBFLOW-PROD.md) |
| Docs | `DOCUMENTACAO-COMPLETA.md`, índice `docs/README.md` |

---

## Funcionalidades entregues (resumo)

### WhatsApp
- Instâncias Evolution, QR, webhook por token
- Inbox tempo real, envio, status de entrega
- IA SUGGEST / FULL_AUTO, pausar/retomar, assumir humano

### CRM
- Pipeline padrão (7 estágios + probabilidade forecast)
- Kanban DnD + socket `deal.moved`
- Leads com valor, temperatura, timeline
- Tarefas e compromissos (calendário)
- Inbox: painel deal, mover etapa, ganho/perda, filtros

### IA
- Múltiplos agentes, KB com embeddings
- Tools (agendar, preço, transferir…)
- Classify + roteamento para agente Vendas
- Resumo de conversa

### SaaS
- Multi-tenant, RBAC
- Planos e limites de uso
- Checkout (mock / Stripe opcional)
- Convites e accept-invite
- Empresa filha (agency)

### Operação
- 16 filas worker ativas
- Relatórios e dashboard com forecast
- Audit log, rate limit
- Scripts Windows (EPERM Prisma, parar dev)

---

## Correções importantes (histórico)

| Problema | Solução |
|----------|---------|
| API não subia (Throttler DI) | `ThrottlerStorageModule` |
| Login travava | Skip throttle em `@Public()` |
| `db:generate` EPERM Windows | `pnpm db:generate:win`, `dev:stop` |
| Migration shadow DB | `db:migrate:deploy`, SQL idempotente |
| `react-big-calendar` | Dependência no web |
| Prisma desatualizado (Google Calendar types) | `db:generate` |

---

## Documentação criada/atualizada

| Arquivo | Descrição |
|---------|-----------|
| [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) | Tudo: arquitetura, fases, API, filas, deploy |
| [docs/README.md](./README.md) | Índice da pasta docs |
| [SISTEMA-PRONTO.md](./SISTEMA-PRONTO.md) | Checklist interno |
| [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) | VPS passo a passo |
| [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md) | Serviços externos |
| [PROXIMAS-FASES.md](./PROXIMAS-FASES.md) | Status + backlog |
| [WHATSAPP-INBOX-IA.md](./WHATSAPP-INBOX-IA.md) | Guia WhatsApp |
| [AGENDAMENTO-CALENDARIO.md](./AGENDAMENTO-CALENDARIO.md) | Calendário |
| [AUTOMACOES-N8N.md](./AUTOMACOES-N8N.md) | n8n |

### Infra no repo

| Arquivo | Uso |
|---------|-----|
| `docker/docker-compose.prod.yml` | Stack produção |
| `docker/Caddyfile` | HTTPS |
| `docker/.env.production.example` | Env produção |
| `scripts/vps-migrate.sh` | Migrations VPS |
| `scripts/prisma-generate.ps1` | Windows |
| `scripts/stop-leadflow-node.ps1` | Parar dev |

---

## Comandos

```bash
# Local
pnpm docker:up && pnpm install
pnpm db:generate    # ou db:generate:win
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
pnpm validate:health

# Produção (VPS)
cp docker/.env.production.example .env
./scripts/vps-migrate.sh
pnpm deploy:prod:up
```

**Demo:** `demo@leadflow.ai` / `demo1234`

---

## Pendente (não é código)

- [ ] VPS Hostinger + DNS + `.env` produção
- [ ] `OPENAI_API_KEY` produção
- [ ] WhatsApp Evolution em produção
- [ ] GitHub + CI (opcional)
- [ ] n8n servidor (opcional)
- [ ] Stripe real (opcional)

---

## Backlog opcional (produto)

- Editor drag-and-drop automações
- Asaas
- RLS Postgres
- Swagger público
- Mobile inbox
