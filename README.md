# LeadFlow AI

CRM WhatsApp com IA, automações e múltiplos agentes inteligentes.

**Documentação completa (tudo que foi desenvolvido + deploy):** [docs/DOCUMENTACAO-COMPLETA.md](./docs/DOCUMENTACAO-COMPLETA.md) · [Índice docs](./docs/README.md)

## Stack

- **Frontend:** Next.js 14 (App Router) + React + TypeScript + TailwindCSS + shadcn/ui
- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL + Redis + BullMQ + Socket.IO
- **Integrações:** Evolution API (WhatsApp), OpenAI, n8n
- **Infra:** Docker Compose, pnpm workspaces + turborepo

## Estrutura

```
apps/
  web/        # Next.js (porta 3000)
  api/        # NestJS REST + WebSocket (porta 3001)
  worker/     # BullMQ consumers
packages/
  database/   # Prisma schema + client
  shared/     # zod DTOs, enums, eventos, nomes de filas
docker/       # docker-compose + Dockerfiles
```

## Quickstart (Fase 0)

Pré-requisitos: Docker Desktop, Node.js 20+, pnpm 9+.

```bash
# 1) Copiar variáveis de ambiente
cp .env.example .env

# 2) Subir Postgres + Redis + Evolution API (imagem v2.3.7+ — QR funciona)
pnpm docker:up

# Se o QR ficar vazio (count:0), recrie só a Evolution:
# docker compose -f docker/docker-compose.yml up -d evolution-api --force-recreate

# 3) Instalar dependências (uma única vez)
pnpm install

# 4) Gerar Prisma client + migrar + seed
pnpm db:generate
# Windows: se der EPERM com `pnpm dev` rodando, use `pnpm db:generate:win` ou `pnpm dev:stop` antes
pnpm db:migrate
pnpm db:seed

# 5) Rodar API + Worker + Web em paralelo
pnpm dev
```

Acessos:

- Web:           http://localhost:3000
- API:           http://localhost:3001/api
- Health:        http://localhost:3001/health
- Evolution API: http://localhost:8080
- Evolution Manager (QR alternativo): http://localhost:8080/manager
- Postgres:      localhost:5432  (user: leadflow / pass: leadflow_dev_password)
- Redis:         localhost:6379

**Conta demo (apenas em dev, criada pelo seed):**
- email: `demo@leadflow.ai`
- senha: `demo1234`

**Segurança:** chaves (`OPENAI_API_KEY`, JWT, Evolution) só no `.env` local — nunca no Git nem no chat. Detalhes em [SECURITY.md](./SECURITY.md).

**Validar API CRM:** com `pnpm dev` rodando, `pnpm validate:crm`.

**Fluxo pós-WhatsApp conectado:** Inbox (`/inbox`) → mensagens em tempo real · agentes IA (SUGGEST ou FULL_AUTO) · criar lead no funil · Kanban/Leads.

**Documentação completa (webhook, IA, troubleshooting):** [docs/WHATSAPP-INBOX-IA.md](./docs/WHATSAPP-INBOX-IA.md)

Resumo rápido:

- **Inbox não precisa de n8n.** WhatsApp → Evolution → `POST /webhooks/evolution/:token` → Redis → worker.
- **Windows + Docker:** `WEBHOOK_PUBLIC_URL=http://host.docker.internal:3001` (não use `localhost` — Evolution no container não alcança a API).
- Após conectar: **Sincronizar webhook** em `/whatsapp`.
- **IA automática no WhatsApp:** agente em modo **FULL_AUTO** + `OPENAI_API_KEY` no `.env`.
- **Inbox vazio / mensagem não aparece:** ver [troubleshooting](./docs/WHATSAPP-INBOX-IA.md#problemas-comuns) no guia.
- **Porta ocupada:** `pnpm dev:ports` → `pnpm dev`.

## Roadmap

- **Fase 0** ✅ Fundação: monorepo, Docker, schema Prisma, NestJS auth + multi-tenant + RBAC, Next.js shell.
- **Fase 1** ✅ WhatsApp Inbox: Evolution, webhook, mensagens, socket, IA no chat — [guia](./docs/WHATSAPP-INBOX-IA.md).
- **Fase 2** ✅ CRM: pipelines, kanban, leads, tarefas, timeline, filtros.
- **Fase 3** ✅ Agentes IA: RAG, tools, classify, resumo, roteamento SDR→Vendas — [guia](./docs/WHATSAPP-INBOX-IA.md).
- **Fase 4** ✅ Automações + n8n — [guia](./docs/AUTOMACOES-N8N.md).
- **Fase 5** ✅ SaaS: limites, checkout (mock/Stripe), convites, agency filha.
- **Fase 6** ✅ Reports, health, rate limit Redis, audit.
- **Fase 7** ✅ Calendário + agendamento IA no WhatsApp, onboarding.

**Checklist sistema pronto:** [docs/SISTEMA-PRONTO.md](./docs/SISTEMA-PRONTO.md)

**Só configurar fora (VPS, Evolution, OpenAI, n8n…):** [docs/CONFIGURACAO-EXTERNA.md](./docs/CONFIGURACAO-EXTERNA.md)

**Deploy Hostinger VPS:** [docs/DEPLOY-HOSTINGER.md](./docs/DEPLOY-HOSTINGER.md) · **RebFlow prod:** [docs/DEPLOY-REBFLOW-PROD.md](./docs/DEPLOY-REBFLOW-PROD.md)

**Docs:** [DOCUMENTACAO-COMPLETA.md](./docs/DOCUMENTACAO-COMPLETA.md) · [SISTEMA-PRONTO.md](./docs/SISTEMA-PRONTO.md) · [DEPLOY-HOSTINGER.md](./docs/DEPLOY-HOSTINGER.md) · [DESENVOLVIMENTO-LOG.md](./docs/DESENVOLVIMENTO-LOG.md) · [PROXIMAS-FASES.md](./docs/PROXIMAS-FASES.md)
