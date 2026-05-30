# LeadFlow AI — Documentação completa

**Versão do produto:** MVP 0.1.0 (maio/2026)  
**Status do código:** desenvolvimento interno **finalizado** — pronto para deploy em VPS.  
**Conta demo (dev):** `demo@leadflow.ai` / `demo1234`

---

## 1. O que é o LeadFlow

SaaS multi-tenant de **CRM + WhatsApp + agentes IA** para equipes de vendas e atendimento:

- Recebe mensagens via **Evolution API** (WhatsApp Web oficial não é obrigatório no MVP).
- **Inbox** em tempo real com sugestão ou resposta automática de IA.
- **Funil** (kanban), leads, tarefas, calendário e **forecast** de vendas.
- **Automações** internas + integração opcional com **n8n**.
- **Multi-empresa**, convites, planos (billing mock ou Stripe), modo **agency** (empresa filha).

---

## 2. Arquitetura

```
┌─────────────┐     HTTPS      ┌──────────────┐
│  Next.js    │ ──────────────►│  NestJS API  │
│  (web:3000) │   REST + WS    │  (api:3001)  │
└─────────────┘                └──────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌──────────┐     ┌──────────┐     ┌──────────────┐
              │ Postgres │     │  Redis   │     │ Evolution API│
              │ pgvector │     │ BullMQ   │     │  (WhatsApp)  │
              └──────────┘     └────┬─────┘     └──────────────┘
                                    │
                              ┌─────▼─────┐
                              │  Worker   │
                              │ (filas)   │
                              └───────────┘
```

| Componente | Tecnologia | Pasta |
|------------|------------|--------|
| Frontend | Next.js 14, React, Tailwind, shadcn | `apps/web` |
| API | NestJS, Prisma, Socket.IO, BullMQ producer | `apps/api` |
| Worker | Node, BullMQ consumers, OpenAI | `apps/worker` |
| Schema | Prisma 5, PostgreSQL + pgvector | `packages/database` |
| Contratos | Zod DTOs, filas, eventos socket | `packages/shared` |
| Motor IA | Tools, RAG, classify, scheduling | `packages/ai-runtime` |
| Automações | Engine de regras e ações | `packages/automation` |
| Google Calendar | OAuth + sync (opcional) | `packages/google-calendar` |

---

## 3. O que foi desenvolvido (por fase)

### Fase 0 — Fundação ✅

- Monorepo pnpm + Turborepo
- Docker Compose local (Postgres, Redis, Evolution v2.3.7)
- Auth JWT + refresh, signup, multi-tenant (`companyId`)
- RBAC (permissões por role)
- Prisma schema completo + seed demo
- Health `/health` e `/health/ready`

### Fase 1 — WhatsApp Inbox ✅

- CRUD instâncias WhatsApp (`/whatsapp`)
- Webhook Evolution `POST /webhooks/evolution/:token`
- Contatos, conversas, mensagens (inbound/outbound)
- Socket.IO (empresa + conversa): mensagens, status, typing
- Fila `process-incoming-message` → automação + classify
- Fila `send-whatsapp-message`
- UI `/inbox` com chat, IA, assumir conversa, pausar IA
- `WEBHOOK_PUBLIC_URL` para Docker/Windows/produção

### Fase 2 — CRM ✅

- Pipelines e estágios (ganho/perda)
- Deals (leads): valor, temperatura, dono humano/IA
- Kanban drag-and-drop (`/kanban/[pipelineId]`)
- Lista e detalhe de leads (`/leads`, `/leads/[dealId]`)
- Timeline unificada (mensagens, IA, tarefas)
- Tarefas (`/tasks`) com tipos TASK e APPOINTMENT
- Contatos

**Polimento CRM (inbox estilo Pipedrive):**

- Painel lateral no Inbox: deal, valor, temperatura, mover etapa, ganho/perda com motivo
- Filtros: todas, não lidas, minhas, sem lead, quentes
- Templates rápidos no composer
- Forecast: `GET /pipelines/:id/forecast`, KPI no dashboard e kanban
- Campos `winReason`, `lossReason`, `winProbability` por etapa

### Fase 3 — Agentes IA ✅

- CRUD agentes (`/agents`), modos SUGGEST e FULL_AUTO
- Knowledge base + embeddings (pgvector), fila `index-knowledge-item`
- Tools: preço, agendar, transferir, etc. (`packages/ai-runtime`)
- `run-ai-agent`, logs de decisão, custo de tokens
- `classify-lead` (temperatura COLD/WARM/HOT)
- Roteamento **SDR → Vendas** (`packages/ai-runtime/src/routing.ts`)
- Resumo de conversa (`summarize-conversation`)
- Playground de teste no formulário do agente

### Fase 4 — Automações ✅

- Pacote `@leadflow/automation` (triggers, condições, ações)
- API `/automations` + UI editor de regras
- Worker `execute-automation`
- Seed com regras demo (mensagem recebida, preço, etc.)
- Scanners: lead parado, tarefa atrasada
- Integração **n8n** (código): outbound HMAC, inbound, UI `/integrations/n8n`

### Fase 5 — SaaS ✅

- Planos e limites (mensagens, instâncias, agentes)
- Billing `/billing` — checkout mock ou Stripe opcional
- Convites equipe: `/team`, `/invite/[token]`, `accept-invite`
- Agency: criar empresa filha em `/settings`
- Multi-tenant em todas as queries

### Fase 6 — Hardening ✅

- Relatórios Recharts (`/reports`)
- Dashboard KPIs (`/dashboard`) + onboarding wizard
- Rate limit por empresa (Redis + `CompanyThrottlerGuard`)
- Audit log (`/logs`) + interceptor em escritas
- `generate-reports` no worker (implementado)
- Throttle ignora rotas `@Public()` (login)

### Fase 7 — Calendário e polimento ✅

- `TaskKind.APPOINTMENT`, integração calendário
- API `/calendar`, UI `/calendar` (react-big-calendar)
- Tool IA `schedule_event` melhorada
- Lembrete WhatsApp (`appointment-reminder-scanner`)
- Google Calendar opcional (`packages/google-calendar`)
- Templates de mensagem (`/templates`)
- Scripts Windows: `db:generate:win`, `dev:stop`, `dev:ports`

---

## 4. Telas da aplicação (Web)

| Rota | Função |
|------|--------|
| `/login`, `/signup` | Autenticação |
| `/dashboard` | KPIs, forecast, onboarding |
| `/inbox` | Chat WhatsApp + painel CRM |
| `/whatsapp` | Conectar número, QR, webhook |
| `/kanban`, `/kanban/[id]` | Funil visual |
| `/leads`, `/leads/[id]` | Lista e detalhe do lead |
| `/tasks` | Tarefas e compromissos |
| `/calendar` | Calendário visual |
| `/agents`, `/agents/[id]` | Agentes IA |
| `/knowledge-base` | Base de conhecimento (RAG) |
| `/automations`, `/automations/[id]` | Regras de automação |
| `/integrations/n8n` | Cadastro webhooks n8n |
| `/templates` | Templates de mensagem |
| `/reports` | Gráficos e métricas |
| `/team` | Convites e usuários |
| `/billing` | Planos e checkout |
| `/settings` | Empresa, agency filha |
| `/logs` | Auditoria |
| `/invite/[token]` | Aceitar convite |

---

## 5. API REST (prefixo `/api`)

| Módulo | Endpoints principais |
|--------|----------------------|
| `auth` | login, signup, refresh, accept-invite |
| `conversations` | list (filtros inbox), get, assume, read, ai/pause, ai/run, create deal |
| `messages` | list, send |
| `whatsapp/instances` | CRUD, sync webhook, QR |
| `webhooks/evolution` | eventos Evolution |
| `deals` | CRUD, move, close, timeline |
| `pipelines` | list, **forecast** |
| `tasks` | CRUD |
| `calendar` | eventos, criar compromisso |
| `contacts` | list, update |
| `ai-agents` | CRUD, test |
| `knowledge-bases` | CRUD itens, reindex |
| `automations` | CRUD regras |
| `templates` | CRUD |
| `n8n` | inbound por slug, config outbound |
| `billing` | planos, checkout, usage |
| `users` | convites |
| `companies` | perfil, children (agency) |
| `dashboard` | stats |
| `reports` | overview, agents, conversion… |
| `logs` | audit |
| `integrations/google-calendar` | OAuth callback, sync |
| `health` | live, ready |

WebSocket: mesmo host da API, eventos em `@leadflow/shared` (`SOCKET_EVENTS`).

---

## 6. Filas do Worker (BullMQ)

Todas implementadas — **sem stub**.

| Fila | Responsabilidade |
|------|------------------|
| `process-incoming-message` | Persistir msg, automação, classify |
| `send-whatsapp-message` | Enviar via Evolution |
| `run-ai-agent` | OpenAI + tools + resposta |
| `classify-lead` | Temperatura + roteamento Vendas |
| `summarize-conversation` | Resumo IA |
| `execute-automation` | Motor de regras |
| `send-to-n8n` | Webhook externo |
| `sync-whatsapp-status` | Status da instância |
| `process-media` | Metadados de mídia |
| `calculate-usage` | Contadores do plano |
| `generate-reports` | Pré-agregação |
| `idle-lead-scanner` | Lead sem interação |
| `task-overdue-scanner` | Tarefa atrasada |
| `appointment-reminder-scanner` | Lembrete de compromisso |
| `sync-google-calendar` | Sync Google (se OAuth) |
| `index-knowledge-item` | Embedding KB |

---

## 7. Banco de dados (migrations)

| Migration | Conteúdo |
|-----------|----------|
| `20260521034459_initial` | Schema base |
| `20260521044436_agente` | Ajustes agente/KB |
| `20260521120000_knowledge_embedding` | pgvector embeddings |
| `20260521140000_task_appointments` | Calendário, APPOINTMENT, Google |
| `20260521160000_crm_forecast` | winProbability, winReason |

Scripts auxiliares:

```bash
pnpm db:apply-calendar   # SQL idempotente calendário
pnpm db:apply-forecast   # SQL idempotente forecast
```

---

## 8. Variáveis de ambiente

Ver `.env.example` e `docker/.env.production.example`.

| Grupo | Variáveis |
|-------|-----------|
| Core | `NODE_ENV`, `TZ` |
| Banco | `DATABASE_URL`, `POSTGRES_*` |
| Redis | `REDIS_URL` |
| API/Web | `API_URL`, `APP_URL`, `WEBHOOK_PUBLIC_URL`, `NEXT_PUBLIC_*` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET` |
| WhatsApp | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` |
| IA | `OPENAI_API_KEY`, modelos |
| Opcional | `GOOGLE_*`, `STRIPE_SECRET_KEY` |

---

## 9. Comandos úteis

### Desenvolvimento local

```bash
cp .env.example .env
pnpm docker:up
pnpm install
pnpm db:generate          # ou db:generate:win no Windows
pnpm db:migrate           # ou db:migrate:deploy
pnpm db:seed
pnpm dev
pnpm validate:health
```

### Produção (VPS)

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
./scripts/vps-migrate.sh
```

Ver [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md).

### Manutenção

| Comando | Uso |
|---------|-----|
| `pnpm dev:stop` | Parar Node do projeto (Windows) |
| `pnpm dev:ports` | Liberar 3000/3001 |
| `pnpm build` | Build de todos os apps |
| `pnpm validate:crm` | Teste rápido API CRM |

---

## 10. Deploy e infraestrutura

| Ambiente | Arquivo / doc |
|----------|----------------|
| Local | `docker/docker-compose.yml` |
| **Instalar do zero em VPS** | [INSTALACAO-VPS.md](./INSTALACAO-VPS.md) |
| Produção VPS | `docker/docker-compose.prod.yml` + [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) |
| Correções RebFlow prod | [DEPLOY-REBFLOW-PROD.md](./DEPLOY-REBFLOW-PROD.md) |
| Contas externas | [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md) |

**Stack em produção rodando:** `rebflow.com.br` (Hostinger KVM2 / Ubuntu 24.04).

**Hostinger VPS 8 GB** cobre: Postgres, Redis, Evolution, API, Worker, Web, HTTPS (Caddy).

**Não precisa no dia 1:** n8n, Stripe, Google Calendar, Meta Cloud API.

---

## 11. O que NÃO está no escopo do código (backlog)

- Editor drag-and-drop de automações
- Asaas / Mercado Pago
- RLS Postgres ativo ([RLS-OPTIONAL.md](./RLS-OPTIONAL.md))
- Swagger UI público
- App mobile
- CI/CD GitHub Actions (a configurar no repositório)
- Testes E2E automatizados (checklist manual em ROADMAP)

---

## 12. Fluxos principais (como usar)

### Atendimento WhatsApp

1. Conectar em `/whatsapp` (QR Evolution).
2. Sincronizar webhook.
3. Mensagem chega → Inbox.
4. IA em FULL_AUTO responde ou humano assume.
5. Criar/gerir lead no painel direito do Inbox.

### Vendas

1. Lead no funil (`/kanban`).
2. Arrastar etapas; forecast no topo.
3. Fechar ganho/perda com motivo.
4. Relatórios em `/reports`.

### Automação

1. Regras em `/automations`.
2. Opcional: n8n em `/integrations/n8n`.

---

## 13. Segurança

- Secrets só em `.env` (nunca no Git).
- JWT por empresa; guards de permissão.
- Webhook Evolution por token por instância.
- n8n inbound com assinatura HMAC.
- Rate limit Redis por empresa.
- Ver [SECURITY.md](../SECURITY.md) na raiz.

---

## 14. Índice de documentos

| Documento | Conteúdo |
|-----------|----------|
| [README.md](./README.md) | Índice da pasta docs |
| [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) | Este arquivo |
| [INSTALACAO-VPS.md](./INSTALACAO-VPS.md) | Instalar do zero em VPS (passo a passo) |
| [SISTEMA-PRONTO.md](./SISTEMA-PRONTO.md) | Checklist “está pronto?” |
| [DESENVOLVIMENTO-LOG.md](./DESENVOLVIMENTO-LOG.md) | Log e histórico |
| [PROXIMAS-FASES.md](./PROXIMAS-FASES.md) | Status fases + backlog |
| [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) | VPS passo a passo |
| [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md) | OpenAI, n8n, Stripe… |
| [WHATSAPP-INBOX-IA.md](./WHATSAPP-INBOX-IA.md) | WhatsApp detalhado |
| [AGENDAMENTO-CALENDARIO.md](./AGENDAMENTO-CALENDARIO.md) | Calendário |
| [AUTOMACOES-N8N.md](./AUTOMACOES-N8N.md) | Automações + n8n |
| [ROADMAP.md](./ROADMAP.md) | Especificação original |

---

*Última atualização da documentação: maio/2026 — MVP interno finalizado, deploy Hostinger documentado.*
