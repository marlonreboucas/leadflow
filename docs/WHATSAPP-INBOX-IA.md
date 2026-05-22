# WhatsApp, Inbox e Agentes IA

Guia operacional validado em ambiente local (Windows + Docker Desktop). Descreve o fluxo ponta a ponta, configuração, uso da IA no Inbox e troubleshooting.

## Arquitetura do fluxo de mensagens

```
Celular (WhatsApp)
    ↓
Evolution API (Docker :8080)
    ↓  POST webhook
LeadFlow API (:3001)  /webhooks/evolution/:token
    ↓  enfileira BullMQ
Worker  process-incoming-message
    ↓  persiste Message + Conversation
PostgreSQL
    ↓  Socket.IO (tempo real)
Next.js Inbox (:3000/inbox)
```

**Importante:** o Inbox **não depende do n8n**. O n8n entra na Fase 4 (automações avançadas). Mensagens entram só via Evolution → webhook → worker.

### Resposta automática da IA (modo FULL_AUTO)

```
Mensagem INBOUND (worker)
    ↓  se: não pausada + agente atribuído + OPENAI_API_KEY + handlingMode compatível
Fila run-ai-agent
    ↓  OpenAI (@leadflow/ai-runtime)
Mensagem OUTBOUND (senderType: AI_AGENT)
    ↓
Fila send-whatsapp-message → Evolution sendText
    ↓
WhatsApp do contato
```

---

## Variáveis de ambiente essenciais

| Variável | Exemplo (dev Windows + Docker) | Função |
|----------|--------------------------------|--------|
| `WEBHOOK_PUBLIC_URL` | `http://host.docker.internal:3001` | URL que a Evolution usa para chamar a API **de dentro do container** |
| `EVOLUTION_API_URL` | `http://localhost:8080` | API Evolution (host → container) |
| `EVOLUTION_API_KEY` | (sua chave) | Autenticação Evolution |
| `OPENAI_API_KEY` | `sk-...` | Geração de respostas da IA (API + worker) |
| `DATABASE_URL` | `postgresql://...` | Postgres |
| `REDIS_URL` | `redis://localhost:6379` | Filas BullMQ + Socket adapter |

### `WEBHOOK_PUBLIC_URL` — regra crítica

- **Correto (Docker no Windows):** `http://host.docker.internal:3001`
- **Errado para Evolution:** `http://localhost:3001` — dentro do container, `localhost` é o próprio container, não o PC. Resultado: `ECONNREFUSED` nos logs da Evolution e **Inbox vazio** para mensagens novas.

O `.env` do host pode estar certo, mas a Evolution pode ainda guardar URL antiga. Use **Sincronizar webhook** (veja abaixo).

---

## Passo a passo: primeira conexão

1. `cp .env.example .env` — ajuste `WEBHOOK_PUBLIC_URL` e `OPENAI_API_KEY`.
2. `pnpm docker:up` — Postgres, Redis, Evolution.
3. `pnpm db:migrate` + `pnpm db:seed` — conta demo `demo@leadflow.ai` / `demo1234`.
4. `pnpm dev` — API `:3001`, Web `:3000`, Worker (filas).
5. Acesse **WhatsApp** (`/whatsapp`), crie/conecte instância (QR ou Manager `http://localhost:8080/manager`).
6. Status **CONNECTED** → clique **Sincronizar webhook**.
7. Abra **Inbox** (`/inbox`) e envie/receba mensagens de teste.

### Sincronizar webhook

- **UI:** `/whatsapp` → botão **Sincronizar webhook** na instância conectada.
- **API:** `POST /api/whatsapp/instances/:id/webhook`
- **O que faz:** grava na Evolution a URL  
  `{WEBHOOK_PUBLIC_URL}/webhooks/evolution/{webhookToken}`  
  com eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`.

O serviço também corrige:

- URL com `localhost` quando o esperado é `host.docker.internal`
- `webhookByEvents` inconsistente (a API aceita `POST .../:token` e `POST .../:token/messages-upsert`)

---

## Inbox — controles da conversa

| Controle | Efeito |
|----------|--------|
| Selo **IA** na lista | Conversa tem agente IA atribuído (`currentAgent`) — **não** significa que já respondeu |
| **IA** (estrela) | Enfileira `run-ai-agent` para a **última mensagem recebida** (útil para mensagens antigas) |
| **Pausar IA** | `isAiPaused = true` — worker não dispara IA em novas mensagens |
| **Ativar IA** | Remove pausa e reatribui agente padrão |
| **Assumir** | Modo humano na conversa |
| **Enviar** | Mensagem manual (humano), fila `send-whatsapp-message` |

Atualização da lista: polling ~8s + eventos Socket (`MESSAGE_RECEIVED`, `MESSAGE_SENT`, `CONVERSATION_UPDATED`).

---

## Agentes IA — modos

Configuração em **Agentes IA** (`/agents`). O seed cria **SDR Demo** em modo **SUGGEST** por padrão.

| Modo (`AiAgent.mode`) | Comportamento no Inbox |
|------------------------|-------------------------|
| `SUGGEST` | Gera texto; exibe caixa roxa **Sugestão da IA**; humano clica **Usar sugestão** → **Enviar** |
| `FULL_AUTO` | Gera e envia ao WhatsApp automaticamente em cada mensagem **nova** (após salvar o agente) |
| `HUMAN_APPROVAL` | Igual sugestão (não envia sozinho) |

**Mensagens que chegaram antes** de mudar para `FULL_AUTO` **não** são reprocessadas sozinhas. Para essas: botão **IA** na conversa ou peça uma **nova mensagem** no WhatsApp.

### Requisitos para a IA rodar

- `OPENAI_API_KEY` no `.env` (worker carrega via `dotenv/config`)
- Agente **ativo** atribuído à conversa (`currentAgentId`)
- Conversa **não** pausada (`isAiPaused = false`)
- `handlingMode` em `AI_FIRST`, `AI`, `AI_SUGGEST` ou `AUTO_ROUTING` (padrão em conversas novas: `AI_FIRST`)
- Worker rodando (`pnpm dev` inclui `@leadflow/worker`)

### Base de conhecimento (exemplo validado)

O seed associa **SDR Demo** à KB com item **Plano Starter** (R$ 97/mês). Perguntas como *“quero orçamento”* / *“programa de afiliado”* usam esse contexto; se não houver dado na KB, o agente pode oferecer transferência para humano.

---

## Endpoints e filas relevantes

| Caminho / fila | Descrição |
|----------------|-----------|
| `POST /webhooks/evolution/:token` | Webhook base |
| `POST /webhooks/evolution/:token/:eventPath` | Ex.: `messages-upsert` (Evolution com `webhookByEvents`) |
| `POST /api/conversations/:id/ai/run` | Dispara IA manualmente |
| `POST /api/conversations/:id/ai/pause` | Pausa IA |
| `POST /api/conversations/:id/ai/resume` | Reativa IA |
| Fila `process-incoming-message` | Persiste mensagem recebida |
| Fila `run-ai-agent` | Executa `@leadflow/ai-runtime` |
| Fila `send-whatsapp-message` | Envia texto via Evolution |

---

## Logs e diagnóstico

### 1. Evolution (Docker)

```bash
docker logs leadflow-evolution --tail 30
```

| Sintoma no log | Causa provável | Ação |
|----------------|----------------|------|
| `ECONNREFUSED` + `localhost:3001` | Webhook apontando para localhost dentro do Docker | `WEBHOOK_PUBLIC_URL=host.docker.internal` + **Sincronizar webhook** |
| `404` em `.../messages-upsert` | API antiga sem rota por evento | Atualizar API; rota já suportada em `webhook.controller.ts` |
| `Aguardando X segundos antes da próxima tentativa` | Evolution reenviando após falha | Corrigir URL; mensagem antiga pode não entrar — enviar **nova** mensagem |

### 2. API (terminal `pnpm dev`)

Procure:

```
Webhook lf-xxxx event=messages.upsert
```

Se só aparecem `GET /api/conversations` e nunca `Webhook`, a Evolution não está alcançando a API.

Confirme: `http://localhost:3001/health` → `{"status":"ok",...}`

### 3. Worker

No mesmo terminal do turbo, fila `run-ai-agent`:

- `[run-ai-agent] OPENAI_API_KEY missing` → configure `.env` e reinicie `pnpm dev`
- `job failed` na fila `send-whatsapp-message` → Evolution rejeitou envio (número inválido, instância desconectada)

### 4. LeadFlow — tela Logs

`/logs` — registros de webhooks recebidos (útil para ver se `messages.upsert` chegou com 200).

### 5. Teste de conectividade (container → API)

```bash
docker exec leadflow-evolution wget -qO- http://host.docker.internal:3001/health
```

Deve retornar JSON com `"status":"ok"`.  
`localhost:3001` **dentro do container** deve falhar (connection refused).

---

## Problemas comuns

### Inbox vazio (mensagem chegou no celular, não no painel)

1. API no ar? `http://localhost:3001/health`
2. `WEBHOOK_PUBLIC_URL` com `host.docker.internal` (Windows + Docker)
3. **Sincronizar webhook** em `/whatsapp`
4. Nova mensagem de teste (webhooks falhos **não** reprocessam mensagens antigas automaticamente)
5. `docker logs leadflow-evolution` sem `ECONNREFUSED`

### Porta 3001 ocupada (`EADDRINUSE`)

```bash
pnpm dev:ports
pnpm dev
```

Libera `:3000` e `:3001` antes de subir o turbo.

### IA não responde (mensagem aparece, sem balão roxo / sem WhatsApp)

1. `OPENAI_API_KEY` definida — reiniciar `pnpm dev`
2. Agente ativo e não pausado
3. Modo **FULL_AUTO** para envio automático; **SUGGEST** só mostra sugestão
4. Mensagem antiga → botão **IA** no topo do chat
5. Worker rodando no `pnpm dev`

### Segunda mensagem não aparece depois que a primeira funcionou

Quase sempre webhook voltou para `localhost` ou API caiu. Repita **Sincronizar webhook** e envie **outra** mensagem; confira logs da Evolution.

### Aviso Redis `allkeys-lru` vs `noeviction`

BullMQ recomenda `noeviction`. Em dev o aviso não costuma impedir o Inbox. Opcional em `docker/docker-compose.yml` na config do Redis.

### Playground / número fictício

Conversas com telefone `5500000000000` são filtradas da lista do Inbox (playground de teste de agente).

---

## Checklist de validação (fluxo completo)

- [ ] `pnpm docker:up` — containers Up
- [ ] `pnpm dev` — API, Web, Worker sem `EADDRINUSE`
- [ ] `http://localhost:3001/health` OK
- [ ] WhatsApp **CONNECTED** em `/whatsapp`
- [ ] **Sincronizar webhook** executado
- [ ] `docker exec ... wget host.docker.internal:3001/health` OK
- [ ] Mensagem recebida aparece em `/inbox`
- [ ] `OPENAI_API_KEY` setada — resposta IA (sugestão ou automática)
- [ ] `/logs` mostra webhook `messages.upsert` com sucesso

---

## Arquivos de código principais

| Arquivo | Responsabilidade |
|---------|------------------|
| `apps/api/src/modules/whatsapp/webhook.controller.ts` | Recebe webhooks Evolution |
| `apps/api/src/modules/whatsapp/whatsapp.service.ts` | Instância, QR, `ensureWebhookRegistered` |
| `apps/worker/src/processors/incoming-message.processor.ts` | Mensagem recebida + enfileira IA |
| `apps/worker/src/processors/run-ai-agent.processor.ts` | OpenAI + cria mensagem outbound |
| `apps/worker/src/processors/send-whatsapp.processor.ts` | Envio Evolution |
| `packages/ai-runtime/src/run.ts` | Prompt, tools, modos SUGGEST / FULL_AUTO |
| `apps/web/src/app/(app)/inbox/page.tsx` | UI Inbox |
| `apps/web/src/app/(app)/whatsapp/page.tsx` | Conexão + sincronizar webhook |

---

## Conta demo e dados de teste

- Login: `demo@leadflow.ai` / `demo1234`
- Agente: **SDR Demo** (tipo SDR, KB Plano Starter)
- Após seed, altere modo do agente em `/agents` conforme o teste (SUGGEST vs FULL_AUTO)

---

*Última validação: maio/2026 — Inbox com múltiplas mensagens, IA em FULL_AUTO respondendo orçamento/KB e transferência quando informação não está na base.*
