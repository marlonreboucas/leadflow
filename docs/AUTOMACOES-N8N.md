# Automações, n8n, Billing e Relatórios

Documentação das Sprints B–E implementadas.

## Sprint B — Motor de automações

### Pacote `@leadflow/automation`

- `evaluateConditions` — operadores: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `notIn`, `contains`, `regex` (sem `eval`)
- `runAction` — executa ações no worker
- `runAutomationEngine` — avalia regras + grava `AutomationExecution`

### Gatilhos disparados automaticamente

| Gatilho | Origem |
|---------|--------|
| `MESSAGE_RECEIVED` | Worker `incoming-message` após cada mensagem inbound |
| `LEAD_CREATED` | API `DealsService.create` |
| `LEAD_STAGE_CHANGED` | API `DealsService.move` |
| `LEAD_IDLE` | Scanner a cada 5 min (config `SCANNER_INTERVAL_MS`) |
| `TASK_OVERDUE` | Scanner a cada 5 min |

### Ações suportadas

- `RUN_AI_AGENT`, `MOVE_STAGE` (com `stageName`), `SEND_WHATSAPP_MESSAGE`, `PAUSE_AI`
- `CREATE_TASK`, `APPLY_TAG`, `CREATE_SUMMARY`, `SEND_N8N_WEBHOOK`

### API

| Método | Path |
|--------|------|
| GET | `/api/automations` |
| GET | `/api/automations/:id` |
| POST | `/api/automations` |
| PATCH | `/api/automations/:id` |
| DELETE | `/api/automations/:id` |
| POST | `/api/automations/:id/conditions` |
| POST | `/api/automations/:id/actions` |
| POST | `/api/automations/:id/test` — dry-run |
| POST | `/api/automations/:id/run` — executa de verdade |

### UI

- `/automations` — lista + criar rascunho
- `/automations/[id]` — editor condições/ações + teste dry-run

### Seed demo

Duas regras ativas para a conta demo:

1. **Mensagem com preço → acionar IA** (regex em `message.body`)
2. **Orçamento → mover para Qualificação**

Rodar após pull: `pnpm db:seed`

---

## Sprint C — n8n

### Outbound

- Fila `send-to-n8n` — POST com header `X-LeadFlow-Signature` (HMAC SHA-256)
- Logs em `WebhookLog` (source `n8n`)

### API

| Método | Path |
|--------|------|
| GET | `/api/n8n/webhooks` |
| POST | `/api/n8n/webhooks` — retorna `secret` (guardar uma vez) |
| POST | `/api/n8n/inbound/:companyId/:slug` — público, valida HMAC |

### UI

- **http://localhost:3000/integrations/n8n** — cadastro de webhooks de saída, eventos, URL inbound documentada

### Ações inbound

- `create_lead` — `{ action, phone, title, name?, valueCents? }`
- `move_stage` — `{ action, dealId, stageId }`

---

## Sprint D — Billing / limites

- `UsageLimiterService` — bloqueia envio se `maxMessagesMonth` do plano estourado
- Contador em `UsageLimit` (métrica `messages`, período `YYYY-MM`)
- Integrado em `MessagesService.send`

---

## Sprint E — Relatórios, health, hardening

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/reports/overview` | Mensagens/dia, leads/etapa, custo IA, top agentes (30 dias) |
| `GET /health` | Liveness |
| `GET /health/ready` | Postgres + Redis (+ Evolution degraded) |

### UI relatórios

- **http://localhost:3000/reports** — gráficos Recharts (mensagens/dia, leads por etapa)

### Rate limit e auditoria

- `CompanyThrottlerGuard` — 200 req/min por empresa (padrão); rotas públicas por IP
- `AuditInterceptor` — mutações autenticadas → tabela `AuditLog` (senhas redigidas)
- Env opcional: `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`

---

## Variáveis de ambiente

```env
SCANNER_INTERVAL_MS=300000
AUTOMATION_IDLE_HOURS=24
AI_SUMMARIZE_EVERY_N=12
THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=200
```

---

## Testar automação

1. `pnpm db:seed`
2. `pnpm dev`
3. `/automations` → abrir regra demo → Testar com "Quero um orçamento"
4. Enviar mensagem real no WhatsApp com "orçamento" → ver execução em histórico da regra
