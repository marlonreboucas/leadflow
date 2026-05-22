# Próximas fases — plano de execução

**Atualizado:** sistema interno considerado **pronto para MVP** — deploy documentado.  
**Doc completa:** [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) · Checklist: [SISTEMA-PRONTO.md](./SISTEMA-PRONTO.md) · VPS: [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) · Externo: [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md)

---

## Estado real do projeto (maio/2026)

| Fase | Status | Observação |
|------|--------|------------|
| **0** Fundação | ✅ | Monorepo, Docker, auth, RBAC, Prisma |
| **1** WhatsApp Inbox | ✅ | Evolution, webhook, socket, IA |
| **2** CRM | ✅ | Kanban, leads, timeline, tarefas |
| **3** Agentes IA | ✅ | RAG, tools, classify, SDR→Vendas, FULL_AUTO demo |
| **4** Automações | ✅ | Engine, UI editor, seed 3 regras |
| **5** SaaS | ✅ | Billing mock/Stripe, convites, agency, limites |
| **6** Hardening | ✅ | Reports, health, Redis throttle, audit |
| **7** Calendário + polimento | ✅ | react-big-calendar, Google opcional, onboarding |

**Todas as filas worker estão implementadas** (sem stub).

---

## Sprints — concluídos

### Sprint A — IA ✅
- RAG, tools, resumo, classify, roteamento SDR→Vendas, KB no formulário

### Sprint B — Automações ✅
- `@leadflow/automation`, worker, API, UI, seed

### Sprint C — n8n ✅ (código; servidor n8n é externo)
- Outbound HMAC, inbound, UI `/integrations/n8n`

### Sprint D — SaaS ✅
- Limites, checkout, convites, agency filha

### Sprint E — Hardening ✅
- Reports Recharts, health ready, throttle, audit

### Sprint F — Calendário ✅
- `schedule_event`, `/calendar`, lembretes, Google Calendar opcional

---

## Só depende de você (externo)

Ver [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md):

- Postgres / Redis / Evolution / `WEBHOOK_PUBLIC_URL`
- `OPENAI_API_KEY`
- n8n (opcional)
- Google Calendar OAuth (opcional)
- Stripe (opcional)
- Deploy produção

---

## Polimento CRM + Inbox (maio/2026) ✅

- Inbox estilo Pipedrive: painel do deal, filtros, templates rápidos
- Forecast por etapa (`GET /pipelines/:id/forecast`)
- Ganho/perda com motivo (`winReason` / `lossReason`)
- Dashboard: KPI forecast + ganhos no mês

```bash
pnpm db:apply-forecast   # se migrate dev falhar
```

---

## Backlog opcional (pós-MVP)

- [ ] Editor drag-and-drop de automações
- [ ] Asaas
- [ ] RLS Postgres ativo
- [ ] Swagger público
- [ ] Mobile inbox

---

## Comandos

```bash
pnpm docker:up
pnpm install
pnpm db:migrate:deploy
pnpm db:generate   # pare pnpm dev antes, se EPERM no Windows
pnpm db:seed
pnpm dev
pnpm validate:health
```
