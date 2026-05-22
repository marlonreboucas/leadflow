# Calendário e agendamento (WhatsApp + IA)

## Visão geral

O agente IA pode **agendar compromissos** durante a conversa no WhatsApp. Os eventos aparecem em **Calendário** (`/calendar`) e geram:

1. Registro `Task` com `kind = APPOINTMENT`
2. Mensagem de **confirmação** no WhatsApp (se instância conectada)
3. **Lembrete** automático ~24h antes (`APPOINTMENT_REMINDER_HOURS` no `.env`)

---

## Tool do agente: `schedule_event`

| Parâmetro | Descrição |
|-----------|-----------|
| `title` | Nome do compromisso (obrigatório) |
| `dueAt` | ISO 8601, ex. `2026-05-22T17:00:00.000Z` |
| `dueAtText` | Português: `amanhã 14h`, `segunda 10:00` |
| `conversationId` | Preenchido automaticamente pelo runtime |
| `dealId` | Preenchido se houver lead vinculado |
| `durationMinutes` | Padrão 60 |

### Exemplos de mensagens do cliente

- "Quero agendar uma demo amanhã às 15h"
- "Pode marcar reunião segunda 10h?"

Com agente em **FULL_AUTO**, a IA deve chamar `schedule_event` e confirmar o horário na resposta.

---

## API

| Método | Path |
|--------|------|
| GET | `/api/calendar/events?from=&to=` |
| POST | `/api/calendar/events` |
| DELETE | `/api/calendar/events/:id` |

---

## Automações

- Ação **Agendar compromisso** (`CREATE_FUTURE_EVENT`) no editor `/automations/[id]`
- Seed demo: regra **"Agendar → IA"** (mensagem com agendar/marcar/horário → `RUN_AI_AGENT`)

---

## Variáveis de ambiente

```env
APPOINTMENT_REMINDER_HOURS=24
SCANNER_INTERVAL_MS=300000
```

---

## Migrar banco

```bash
pnpm db:migrate
# ou: pnpm db:generate && aplicar migration 20260521140000_task_appointments
```

---

## Teste rápido

1. Agente SDR ou Vendas em **FULL_AUTO**
2. WhatsApp conectado
3. Envie: **"Quero agendar uma demonstração amanhã às 14h"**
4. Abra `/calendar` — deve listar o compromisso
5. Cliente recebe confirmação no chat
