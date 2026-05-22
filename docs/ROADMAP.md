# LeadFlow AI — Roadmap & Handoff

Documento único para retomar o projeto. Cobre: o que já foi feito (Fase 0), como subir o ambiente, padrões de código, e o passo a passo detalhado das Fases 1 a 6 — incluindo arquivos a criar, ordem, contratos de API e critérios de aceite.

---

## 0. Estado atual (Fase 0 concluída)

**Localização:** `C:\Users\marlo\projects\leadflow-ai`

**Stack travada:** Next.js 14 + NestJS + Prisma + Postgres (pgvector) + Redis + BullMQ + Socket.IO + Evolution API + OpenAI + n8n. pnpm workspaces + turborepo.

**Já implementado:**

- Monorepo (`apps/web`, `apps/api`, `apps/worker`, `packages/database`, `packages/shared`)
- Docker Compose com **postgres+pgvector**, **redis**, **evolution-api** + Dockerfiles de api/worker/web
- **Prisma schema completo** (~35 modelos: empresas, users, RBAC, planos, billing, WhatsApp, contatos, conversas, mensagens, pipelines, deals, tasks, tags, agentes IA, regras, KB, automações, n8n, templates, logs)
- **Seed** com 15 permissões, 8 roles de sistema, 4 planos (Starter/Pro/Business/Agency) e conta demo (`demo@leadflow.ai` / `demo1234`) com pipeline padrão de 7 etapas
- **packages/shared:** zod DTOs (auth), `SOCKET_EVENTS`, `QUEUES`, `PERMISSIONS`
- **API (NestJS):** auth (signup/login/refresh/switch-company), users/me, companies/me, rbac, health, throttler, pino, CORS
- Guards globais: **JwtAuthGuard** (com `@Public()`) e **PermissionGuard** (com `@RequirePermissions(...)`)
- **TenantInterceptor** + **CompanyContext** (AsyncLocalStorage) — isolamento multi-tenant
- **Worker (BullMQ):** todas as 13 filas registradas com stubs
- **Web (Next 14):** login, signup, dashboard (KPIs vazios), sidebar completa, dark mode, axios com auto-refresh, zustand persistente, sonner toasts, Tailwind + shadcn (Button/Input/Card/Label)

**Itens deferidos (intencionais):**

- pgvector index/migration sobre `KnowledgeItem.embedding` → Fase 3
- Socket.IO gateway montado → Fase 1
- Endpoints de Evolution e webhook receiver → Fase 1
- RLS Postgres em tabelas sensíveis → Fase 6 (hardening)
- Index parcial único em `Role(companyId NULL, slug)` → Fase 6

---

## 1. Como subir o ambiente (uma única vez)

Pré-requisitos: Docker Desktop, Node.js 20+, pnpm 9+.

```bash
cd C:\Users\marlo\projects\leadflow-ai
cp .env.example .env

# Sobe Postgres (com pgvector), Redis e Evolution API
pnpm docker:up

# Instala dependências do monorepo
pnpm install

# Gera Prisma Client, aplica migrations, popula seed
pnpm db:generate
pnpm db:migrate           # cria a migration "init"
pnpm db:seed              # roles, permissions, planos, conta demo

# Dev em paralelo: API (3001) + Worker + Web (3000)
pnpm dev
```

**Endpoints rápidos:**

- Web: http://localhost:3000
- API: http://localhost:3001/api
- Health: http://localhost:3001/health
- Evolution: http://localhost:8080 (`apikey` = `EVOLUTION_API_KEY` do `.env`)

---

## 2. Convenções e onde está cada coisa

### Estrutura

```
apps/
├── web/src/
│   ├── app/(auth)/         # rotas públicas
│   ├── app/(app)/          # rotas autenticadas (sidebar)
│   ├── components/ui/      # shadcn primitives
│   ├── components/         # composições próprias
│   ├── lib/                # api, auth-store, utils
│   └── hooks/, stores/
├── api/src/
│   ├── modules/<feature>/  # 1 módulo = 1 feature (auth, users, companies, rbac, …)
│   ├── common/             # guards, interceptors, decorators, tenant
│   ├── integrations/       # clients externos (evolution, openai, n8n)
│   ├── prisma/             # PrismaService + PrismaModule
│   └── config/             # env validado por zod
└── worker/src/
    ├── processors/         # 1 arquivo por job
    └── redis.ts, main.ts
packages/
├── database/prisma/        # schema.prisma + seed
└── shared/src/             # zod DTOs, eventos, filas, permissões
```

### Padrões obrigatórios

1. **Toda query do Prisma escopada por `companyId`.** Mesmo quando óbvio. O `TenantInterceptor` já popula o contexto; serviços extraem com `CompanyContext.require()`.
2. **Endpoint protegido por permissão** com `@RequirePermissions(PERMISSIONS.X)` — nunca `@Roles(...)` (papéis mudam, permissões são estáveis).
3. **Endpoint público** com `@Public()`. Sem `@Public()`, JWT é obrigatório (guard global).
4. **DTOs sempre com zod** via `nestjs-zod`. Define-se em `packages/shared/src/dto/<feature>.ts`, expõe-se via `class XxxDto extends createZodDto(schema)`.
5. **Eventos Socket.IO** usam constantes de `@leadflow/shared` (`SOCKET_EVENTS`). Nunca strings literais.
6. **Filas BullMQ** usam constantes de `@leadflow/shared` (`QUEUES`). Para enfileirar a partir da API: injetar `Queue` via `@nestjs/bullmq` (a configurar na Fase 1).
7. **Mensagem do agente IA** sempre tem `senderType=AI_AGENT` + `senderAgentId`. Mensagem humana: `senderType=USER` + `senderUserId`. Nunca misturar.
8. **Idempotência em webhooks** com chave `externalId` (Evolution) ou hash do payload. Sempre passar pelo `WebhookLog`.
9. **Custos de IA** sempre logados em `AiAgentLog` (inputTokens/outputTokens/costCents).
10. **Comentários:** só onde o porquê não é óbvio. Sem narração do que o código faz.

---

## 3. Fase 1 — WhatsApp Inbox (passo a passo)

**Objetivo:** usuário conecta um número WhatsApp via QR code, mensagens entram e saem, inbox aparece em tempo real.

**Guia operacional validado (dev local, webhook, IA, troubleshooting):** [WHATSAPP-INBOX-IA.md](./WHATSAPP-INBOX-IA.md)

**Duração estimada:** 1.5–2 semanas.

### 3.1. Pré-requisitos da fase

- Adicionar pacotes na API:

  ```jsonc
  // apps/api/package.json (dependencies)
  "@nestjs/bullmq": "^10.1.1",
  "@nestjs/event-emitter": "^2.0.4",
  "qrcode": "^1.5.3"
  ```

- Atualizar `apps/worker/package.json` com `@leadflow/shared` já está; adicionar `openai` virá só na Fase 3.

### 3.2. Cliente Evolution

Criar `apps/api/src/integrations/evolution/`:

- `evolution.client.ts` — Axios client com base URL `env.EVOLUTION_API_URL` e header `apikey: env.EVOLUTION_API_KEY`. Métodos:

  ```ts
  createInstance(name, webhookUrl)
  fetchInstance(name)
  deleteInstance(name)
  connectInstance(name)        // dispara QR
  fetchQr(name)
  setWebhook(name, url, events)
  sendText(name, to, text)
  sendMedia(name, to, mediaUrl, type, caption?)
  ```

- `evolution.types.ts` — tipagem dos payloads dos webhooks (`messages.upsert`, `messages.update`, `connection.update`, `qrcode.updated`).

- `evolution.module.ts` exporta `EvolutionClient` como provider.

### 3.3. Módulo `whatsapp`

`apps/api/src/modules/whatsapp/`:

- `whatsapp.service.ts`
  - `createInstance(companyId)` → checa limite do plano (`UsageLimit` + `plan.limits.maxInstances`), gera `webhookToken` (cuid), chama Evolution `createInstance` com `webhookUrl = WEBHOOK_PUBLIC_URL/webhooks/evolution/<token>`, persiste `WhatsappInstance`, emite `whatsapp.status.updated`.
  - `listInstances(companyId)`
  - `getInstance(companyId, id)` (verifica posse)
  - `deleteInstance(companyId, id)` — chama Evolution + soft delete + emite evento
  - `restartInstance(companyId, id)`
  - `getQr(companyId, id)` — busca QR fresco da Evolution, converte para data URL se vier base64

- `whatsapp.controller.ts` — endpoints conforme arquitetura (`POST /whatsapp/instances`, etc.) com `@RequirePermissions(PERMISSIONS.WHATSAPP_CONNECT)`.

- `whatsapp.module.ts` — importa `EvolutionModule`, `RealtimeModule`, `BullModule.registerQueue({ name: QUEUES.SEND_WHATSAPP })`.

### 3.4. Webhook receiver

`apps/api/src/modules/whatsapp/webhook.controller.ts`:

```ts
@Public()
@Controller('webhooks/evolution')
export class EvolutionWebhookController {
  @Post(':token')
  async handle(@Param('token') token: string, @Body() payload: any) {
    // 1. find WhatsappInstance by webhookToken (rejeita 404 se não achar)
    // 2. WebhookLog.create({ source: 'evolution', direction: INBOUND, payload })
    // 3. switch payload.event:
    //      'messages.upsert'    → enqueue processIncomingMessage
    //      'messages.update'    → enqueue processIncomingMessage (status update)
    //      'connection.update'  → update instance.status + emit whatsapp.status.updated
    //      'qrcode.updated'     → save qrCode + emit whatsapp.status.updated
    // 4. return 200 vazio rápido (idempotência no worker)
  }
}
```

Critério: webhook sempre retorna 2xx rápido. Toda lógica vai pra fila.

### 3.5. Modelo de domínio

`apps/api/src/modules/contacts/contacts.service.ts`:

- `findOrCreateByPhone(companyId, phone, name?)` — `upsert` em `(companyId, phone)`.

`apps/api/src/modules/conversations/conversations.service.ts`:

- `findOrCreate(companyId, contactId, instanceId)` — se não existe, cria com `status=NEW`, `handlingMode=AI_FIRST`.
- `list(companyId, filters)` — paginação por cursor (`lastMessageAt`), filtros: `status`, `assignedUserId`, `currentAgentId`, `q` (busca em contact.name/phone).
- `get(companyId, id)` — inclui contact + lastMessage.
- `assume(companyId, id, userId)` — set `assignedUserId`, `status=IN_PROGRESS`, emit `agent.assigned` e `conversation.updated`.
- `transfer(companyId, id, { userId?, agentId? })`.
- `pauseAi(companyId, id, reason)` / `resumeAi(companyId, id)`.

`apps/api/src/modules/messages/messages.service.ts`:

- `list(conversationId, cursor)` — paginação reversa.
- `send(companyId, conversationId, userId, body)` — cria Message(PENDING, OUTBOUND, USER), enfileira `sendWhatsAppMessage`, emite `message.sent` (status=PENDING).
- `retry(companyId, messageId)`.

### 3.6. Workers reais

`apps/worker/src/processors/incoming-message.processor.ts`:

```
1. payload = job.data (evolution messages.upsert payload)
2. para cada msg no array:
   - se já existe Message com externalId, skip (idempotência)
   - Contact.findOrCreate por phone
   - Conversation.findOrCreate (status=NEW se nova)
   - Message.create(direction=INBOUND, status=DELIVERED, senderType=CONTACT, body, type, mediaUrl?)
   - Conversation.update(lastMessageAt, unreadCount: { increment: 1 })
3. emit Socket.IO:
   - message.received → room conversation:{id}
   - conversation.updated → room company:{id}
4. dispatch AutomationEngine(MESSAGE_RECEIVED) — Fase 4 (na Fase 1 deixar TODO)
5. se conv.handlingMode in (AI, AI_FIRST, AI_SUGGEST, AUTO_ROUTING)
     → enqueue runAIAgent { conversationId } — Fase 3 (na Fase 1 deixar TODO)
```

`apps/worker/src/processors/send-whatsapp.processor.ts`:

```
1. lê Message por id
2. chama Evolution sendText/sendMedia (idempotency key = message.id)
3. on success: Message.update({ status: SENT, externalId, sentAt }) + emit message.status.updated
4. on fail: BullMQ retry; após esgotar tentativas → status=FAILED + errorReason
```

`apps/worker/src/processors/process-media.processor.ts`:

- Baixa mídia da Evolution, faz upload pra S3/MinIO (deferir storage real — pode salvar em filesystem local em dev), atualiza `Message.mediaUrl` com URL pública.

### 3.7. Socket.IO Gateway

`apps/api/src/modules/realtime/`:

- `realtime.gateway.ts` — `@WebSocketGateway({ cors: { origin: env.APP_URL, credentials: true } })`
  - `handleConnection(socket)` — extrai JWT do `auth.token` no handshake, valida via JwtService, popula `socket.data.user`, faz `socket.join(roomKey.company(companyId))`.
  - `@SubscribeMessage(SOCKET_EVENTS.CONVERSATION_JOIN)` → join `roomKey.conversation(id)` (após verificar posse).
  - `@SubscribeMessage(SOCKET_EVENTS.CONVERSATION_LEAVE)`.
  - método `emitToCompany(companyId, event, payload)` e `emitToConversation(convId, event, payload)`.
- `realtime.module.ts` — registra adapter Redis (`@socket.io/redis-adapter` + ioredis) e exporta o gateway.
- Em `main.ts`: `app.useWebSocketAdapter(new IoAdapter(app))` (default já serve).

Web side: `apps/web/src/lib/socket.ts` — `io(NEXT_PUBLIC_WS_URL, { auth: { token: accessToken } })`; expor hook `useSocket()` e `useConversationStream(conversationId)`.

### 3.8. Telas — Inbox

`apps/web/src/app/(app)/inbox/`:

- `page.tsx` — layout em 3 colunas com `Suspense`. Roteamento: `/inbox` mostra lista + placeholder, `/inbox/[conversationId]` carrega a conversa.
- `[conversationId]/page.tsx` — `ChatStream` + `Composer` + `LeadPanel`.

Componentes (`apps/web/src/components/inbox/`):

- `ConversationList.tsx` — virtualização (react-virtuoso ou windowed), filtros por status/assignee/agent, busca, badge de `unreadCount`. Refresca via Socket.IO (`conversation.updated`).
- `ChatStream.tsx` — bolhas com variantes por `senderType`. Badge "IA — <agentName>" para mensagens com `senderType=AI_AGENT`. Carrega histórico via React Query com paginação reversa.
- `Composer.tsx` — input texto + botões: Anexo, Template, **Sugerir resposta** (Fase 3), **Assumir**, **Ativar IA / Pausar IA**, **Transferir**. Enter envia, Shift+Enter quebra linha.
- `LeadPanel.tsx` — tabs: Dados, Resumo IA, Deal, Ações IA, Histórico de atribuição.

Estado: zustand `useInboxStore` com filtros e conversa ativa.

### 3.9. Endpoints da Fase 1

| Método | Path | Permissão |
|---|---|---|
| POST | `/whatsapp/instances` | `whatsapp.connect` |
| GET | `/whatsapp/instances` | `whatsapp.connect` ou `conversations.view` |
| GET | `/whatsapp/instances/:id/qr` | `whatsapp.connect` |
| POST | `/whatsapp/instances/:id/restart` | `whatsapp.connect` |
| DELETE | `/whatsapp/instances/:id` | `whatsapp.connect` |
| GET | `/conversations` | `conversations.view` |
| GET | `/conversations/:id` | `conversations.view` |
| PATCH | `/conversations/:id` | `conversations.view` |
| POST | `/conversations/:id/assume` | `conversations.assume` |
| POST | `/conversations/:id/transfer` | `conversations.assume` |
| POST | `/conversations/:id/ai/pause` | `conversations.assume` |
| POST | `/conversations/:id/ai/resume` | `conversations.assume` |
| GET | `/conversations/:id/messages` | `conversations.view` |
| POST | `/messages` | `messages.send` |
| POST | `/messages/:id/retry` | `messages.send` |
| POST | `/webhooks/evolution/:token` | `@Public()` |

### 3.10. Eventos Socket.IO da Fase 1

- `conversation.created`, `conversation.updated`, `message.received`, `message.sent`, `message.status.updated`, `whatsapp.status.updated`, `agent.assigned`

### 3.11. Critérios de aceite (Fase 1)

- [ ] Criar instância → receber QR no front → escanear no celular → status muda para CONNECTED em tempo real.
- [ ] Enviar mensagem do WhatsApp para o número → aparece no inbox instantaneamente; contact e conversation criados.
- [ ] Enviar mensagem pelo composer → chega no celular; status atualiza PENDING → SENT → DELIVERED → READ.
- [ ] Reload da página mantém a conversa carregada e o socket reconecta.
- [ ] Atendente assume conversa → outros usuários veem `agent.assigned` em tempo real.
- [ ] Webhook duplicado (mesmo `externalId`) não cria mensagem duplicada.
- [ ] Usuário de outra empresa não consegue ler instância/conversa/mensagem (testar com 2 contas).

---

## 4. Fase 2 — CRM (Kanban + Leads + Tarefas)

**Objetivo:** pipelines, kanban drag-and-drop, detalhe do lead, tarefas.

**Duração estimada:** 1 semana.

### 4.1. Módulos backend

`pipelines`, `deals`, `tasks`, `tags` em `apps/api/src/modules/`.

- `PipelineService` — CRUD funis + stages (com posição). Funil padrão criado no signup (mover lógica do seed para o `AuthService.signup`).
- `DealService`
  - `list(companyId, filters)` — por pipeline, stage, owner (user OU agent), temperatura, status, q.
  - `create`, `update`, `move(dealId, toStageId)` — emite `deal.moved`.
  - `close(dealId, status: WON|LOST, lossReason?)` — emite `lead.updated`.
- `TaskService` — CRUD; campo `createdByAgentId` opcional; cron `task-overdue-scanner` notifica via Socket.IO.

### 4.2. Telas

- `/kanban/[pipelineId]` — board com `@dnd-kit/core`. Cada `<DealCard>` mostra: título, valor, contact, dono (humano OU IA com avatar e badge). Atualiza posição local otimisticamente; chama `POST /deals/:id/move`; rollback em erro.
- `/leads` — tabela virtualizada com filtros e bulk actions.
- `/leads/[dealId]` — timeline mesclando: mensagens, automações executadas, mudanças de stage, tarefas, decisões IA.
- `/tasks` — lista + calendário simples.

### 4.3. Critérios de aceite

- [ ] Arrastar card entre colunas dispara `deal.moved` para todos os clientes conectados da empresa.
- [ ] Criar deal a partir de uma conversa (botão no `LeadPanel`).
- [ ] Tarefas com prazo aparecem em destaque; "criada por IA" mostra badge.
- [ ] Filtros de kanban (por dono humano vs IA) funcionam.

---

## 5. Fase 3 — Agentes IA

**Objetivo:** módulo de agentes funcionais, runtime com tools + RAG + guardrails.

**Duração estimada:** 2 semanas.

### 5.1. Backend

`apps/api/src/integrations/openai/`:

- `openai.client.ts` — wrapper `chat.completions.create` com tool use; `embeddings.create` para indexação.
- `prompts.ts` — montagem de system prompt com: persona do agente, regras da empresa, snippet de KB top-K, resumo da conversa, dados do contato/deal.
- `tools.ts` — definição declarativa das tools: `move_deal_stage`, `apply_tag`, `create_task`, `schedule_event`, `transfer_to_human`, `send_template`, `update_lead_field`, `request_knowledge`.

`apps/api/src/modules/ai-agents/` — CRUD de agentes (`AiAgent`, `AiAgentRule`), playground (`POST /ai-agents/:id/test` retorna resposta sem persistir nem enviar).

`apps/api/src/modules/knowledge-base/` — CRUD + bulk import + indexação:

- Migration custom (`prisma migrate --create-only` + edição manual) adicionando coluna `embedding vector(1536)` em `KnowledgeItem` + índice IVFFLAT.
- `KnowledgeIndexer.queueIndex(itemId)` → worker que chama OpenAI embeddings e faz `UPDATE knowledge_items SET embedding = $1 WHERE id = $2` via `$executeRawUnsafe`.
- `KnowledgeRetriever.search(kbIds, query, topK)` — `SELECT * FROM knowledge_items WHERE kb_id IN (...) ORDER BY embedding <=> $1 LIMIT $2`.

`apps/api/src/modules/ai-runtime/ai-runtime.service.ts`:

```ts
async run({ conversationId, agentId? }) {
  // 1. carrega contexto (conversation, contact, deal, agent, summary, KB matches, últimas N msgs)
  // 2. guardrails pré: businessHours, isAiPaused, customer asks human, limite uso
  // 3. monta messages[] + tools
  // 4. openai.chat.completions.create (with model from agent)
  // 5. interpreta tool calls e executa via AiToolExecutor
  // 6. guardrails pós: preço sem snapshot, reclamação detectada
  // 7. mode:
  //    FULL_AUTO → cria Message(senderType=AI_AGENT) + enqueue sendWhatsAppMessage
  //    SUGGEST   → emit ai.response.generated (não persiste)
  // 8. log AiAgentLog
  // 9. a cada 20 msgs: enqueue summarizeConversation
}
```

`apps/worker/src/processors/run-ai-agent.processor.ts` — chama `AiRuntimeService.run` (importado via referência de fábrica, já que worker é processo separado — usar Nest standalone application: `NestFactory.createApplicationContext`).

`apps/worker/src/processors/summarize-conversation.processor.ts` — gera resumo curto via OpenAI e persiste `AiConversationSummary`.

### 5.2. Frontend

- `/agents` — listagem com cards por tipo.
- `/agents/[agentId]` — tabs: **Identidade** (nome, avatar, tipo, modelo, voz, objetivo) · **Comportamento** (mode, regras de transferência, perguntas obrigatórias, businessHours) · **Conhecimento** (KBs vinculadas) · **Permissões** (funis/etapas/templates/tags) · **Regras** (DSL visual) · **Playground** (chat de teste).
- `/knowledge-base` — CRUD KBs + itens (FAQ/Produto/Preço/Política/Objeção). Reindex automático ao salvar.

### 5.3. Critérios de aceite

- [ ] Criar agente "SDR" → ativar em conversa → cliente envia "Olá, quanto custa?" → agente responde respeitando KB e move deal para "Qualificação".
- [ ] Cliente diz "quero falar com humano" → agente para, pausa IA, transfere.
- [ ] Modo `SUGGEST`: resposta aparece no composer como sugestão, humano aprova com 1 clique.
- [ ] `AiAgentLog` registra tokens, custo, decisão e razão.
- [ ] Roteamento entre agentes: nova conversa entra no SDR; se score>=80, transfere para Vendedor.

---

## 6. Fase 4 — Automações + n8n

**Objetivo:** engine de regras + editor visual + integração bidirecional com n8n.

**Duração estimada:** 1 semana.

### 6.1. Engine

`apps/api/src/modules/automations/automation-engine.service.ts`:

- `evaluate(companyId, trigger, ctx)` — busca rules ativas por trigger, avalia conditions, enfileira `executeAutomation` para cada match.
- `ConditionEvaluator` puro: aceita `{field, operator, value}` e contexto; suporta `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `notIn`, `contains`, `regex` (regex compilada com timeout). **Nunca usar `eval`.**

`apps/worker/src/processors/execute-automation.processor.ts`:

- Para cada `AutomationAction` em ordem, executa via `ActionExecutor` (delega para serviços já existentes — `MessagesService.send`, `DealsService.move`, `TasksService.create`, etc.).
- Grava `AutomationExecution(SUCCESS | FAILED, log)`.
- Emite `automation.executed`.

Disparadores em pontos de domínio (publicar evento via `EventEmitter2` em `apps/api`):
`message.received` → `MESSAGE_RECEIVED`; `lead.created` → `LEAD_CREATED`; etc. Listener empurra para o engine.

Disparadores por tempo:
- `idle-lead-scanner` (cron BullMQ a cada 5 min) → varre deals com `nextActionAt < now()` e dispara `LEAD_IDLE`.
- `task-overdue-scanner` (idem) → `TASK_OVERDUE`.

### 6.2. n8n

`apps/api/src/integrations/n8n/n8n-dispatcher.service.ts`:

- `dispatch(companyId, event, data)` → para cada `N8nWebhook` que casa, enfileira `sendToN8n`.
- Assinatura HMAC SHA-256 (`X-LeadFlow-Signature`) com `secret` por webhook.

`apps/worker/src/processors/send-to-n8n.processor.ts` — POST, retry exponencial, `WebhookLog`.

Endpoint inbound: `POST /n8n/inbound/:companyId/:slug` autenticado por token + HMAC validado. Aceita ações declarativas (criar lead, mover etapa, etc.) com validação de plano/permissão.

### 6.3. Editor visual

`apps/web/src/app/(app)/automations/[ruleId]/page.tsx`:

- Wizard linear: **Quando** (seleciona trigger + config) → **Se** (conditions, AND lógico) → **Então** (actions em ordem, drag para reordenar).
- Botão **Testar (dry-run)**: chama `POST /automations/:id/test` com payload simulado, mostra qual branch passou e quais ações executariam.
- Histórico: tabela com `AutomationExecution` mais recentes, status colorido, expand para ver log.

### 6.4. Critérios de aceite

- [ ] Regra "se mensagem contém 'preço' E etapa = Qualificação → rota para Vendedor IA" funciona end-to-end.
- [ ] Regra "lead parado 24h → envia template de recuperação" dispara após 24h reais (testar com config 1 min).
- [ ] Falha em uma ação marca execução como FAILED com log da ação que falhou.
- [ ] Webhook out para n8n é assinado e n8n valida; webhook in cria lead via API LeadFlow.

---

## 7. Fase 5 — SaaS comercial

**Objetivo:** planos, billing, multi-empresa, agency white-label.

**Duração estimada:** 1 semana.

### 7.1. Backend

- `apps/api/src/modules/billing/`:
  - Provider abstrato `BillingProvider` com implementações `StripeProvider`, `AsaasProvider`, `MercadoPagoProvider`.
  - `POST /billing/checkout` → cria sessão no provider escolhido com `planSlug` e `companyId` no metadata.
  - `POST /webhooks/billing/:provider` (`@Public()`, valida assinatura) → atualiza `Subscription.status` e cria `BillingEvent`.
- `UsageLimiterGuard` em endpoints de envio:
  - Antes de enfileirar `sendWhatsAppMessage`, incrementa `UsageLimit(companyId, "messages", currentPeriod)`. Se > limit, retorna 402 (Payment Required) com mensagem clara.
  - Antes de criar `WhatsappInstance`/`AiAgent`/`Pipeline`: checa contagem vs `plan.limits`.
- `apps/api/src/modules/companies/` — endpoints para agency criar empresas filhas (`POST /companies` quando role=OWNER em company com `plan.slug=agency`).

### 7.2. Frontend

- `/billing` — plano atual, uso vs limites (barras de progresso), botão "Mudar plano" → checkout.
- `/team/invite` — convidar usuário por email com role pré-selecionada; gera `Invite.token`.
- Onboarding wizard em 4 passos: empresa → plano → conectar WhatsApp → primeiro agente.
- Agency mode: seletor de empresa no header (já tem `/auth/switch-company`).
- White-label: `Company.settings.branding` (logo, cores, domínio próprio) — aplicar via CSS vars em runtime.

### 7.3. Critérios de aceite

- [ ] Trial expira após 14 dias → conta marca `SUSPENDED`, endpoints retornam 402.
- [ ] Estourar `maxMessagesMonth` bloqueia envio e mostra banner.
- [ ] Convite por email funciona; aceitar cria `CompanyUser`.
- [ ] Agency consegue criar empresa filha; switch-company muda contexto sem deslogar.

---

## 8. Fase 6 — Relatórios + Hardening

**Objetivo:** dashboards de IA/vendedor/funil + segurança/observabilidade prontas pra produção.

**Duração estimada:** 1 semana.

### 8.1. Relatórios

- Endpoints `GET /reports/overview|agents|users|conversion|messages` (agregações Postgres com `date_trunc`).
- Telas com Recharts: KPIs, gráficos de mensagens/dia, conversão por etapa, ranking de agentes IA (taxa de transferência, custo, conversão), ranking de vendedores humanos.

### 8.2. Hardening

- **Postgres RLS** em `messages`, `contacts`, `deals`, `conversations` — `current_setting('app.company_id')` setado por session via Prisma `$use` middleware.
- **Rate limit por empresa e por endpoint** com `@nestjs/throttler` + `ThrottlerStorageRedis`.
- **Auditoria automática** — interceptor `AuditInterceptor` em endpoints de escrita marcados com `@Audit('deal:update')` etc., grava em `AuditLog`.
- **Sentry** no API e Worker; **OpenTelemetry** + Prometheus exporter; **Pino** já em produção.
- **Backups** automáticos do Postgres (script `infra/scripts/backup.sh` + cron no host); retenção 30 dias.
- **Vault/SOPS** para secrets em prod; nunca commitar `.env`.
- **Health checks profundos** — `/health/ready` verifica Postgres + Redis + Evolution; usado por k8s readiness se for o caso.

### 8.3. Critérios de aceite

- [ ] Dashboard de agentes mostra custo, taxa de conversão, latência média.
- [ ] Pentest manual básico: tentativa de SQL injection, XSS no composer, IDOR cross-tenant — todas bloqueadas.
- [ ] Carga: 500 msgs/min sustentadas por 10 min sem perda nem leak.
- [ ] Restore de backup em ambiente staging funciona.

---

## 9. Fase 7 — Polimento

- Templates por nicho prontos (Clínicas, Imobiliárias, Oficinas, Agências, Infoprodutores).
- Atalhos de teclado no inbox (`j`/`k` navegação, `e` arquivar, `r` responder, `/` busca).
- Mobile responsivo do inbox (drawer pra lista e painel).
- Documentação OpenAPI/Swagger gerada.
- Tour guiado de onboarding.

---

## 10. Checklist QA contínuo (a ser mantido)

### Unitário

- [ ] AuthService.signup duplicate-email, slug colisão, transação atômica
- [ ] PermissionGuard cada permissão x cada role
- [ ] ConditionEvaluator todos os operadores + edge cases
- [ ] AI guardrails: pedido humano, fora-horário, reclamação, preço não cadastrado
- [ ] N8nSigner HMAC sign + verify
- [ ] UsageLimiter incrementa, bloqueia ao estourar, reseta no virar do mês

### Integração (testcontainers)

- [ ] Webhook Evolution cria contato+conversa+mensagem
- [ ] Idempotência por externalId
- [ ] `runAIAgent` persiste log e respeita mode
- [ ] Automação MESSAGE_RECEIVED → SEND_WHATSAPP_MESSAGE ponta a ponta
- [ ] Cross-tenant isolation: query com outro companyId retorna vazio

### E2E (Playwright)

- [ ] Onboarding → conecta WhatsApp (mock Evolution) → envia primeira msg
- [ ] Cria agente IA → ativa em conversa → IA responde
- [ ] Arrasta deal no kanban e o evento chega via socket
- [ ] Cria automação "preço → rota para Vendedor"

### Permissão / segurança

- [ ] Atendente não consegue editar billing
- [ ] Readonly não escreve em nada
- [ ] Token webhook inválido → 401
- [ ] HMAC errado → 401

### Multi-empresa

- [ ] Usuário em 2 empresas vê apenas dados da ativa
- [ ] Troca de empresa zera caches
- [ ] Agency vê apenas filhas

### Carga (k6)

- [ ] 500 msgs/min por 10 min
- [ ] p95 < 250ms em `/conversations` com 100k registros
- [ ] 100 `runAIAgent` simultâneos sem leak

---

## 11. Decisões a tomar quando chegar a hora

- **Storage de mídia:** S3 vs MinIO local. Recomendação: MinIO em dev (já no docker), S3 ou Cloudflare R2 em prod.
- **Provedor de billing brasileiro:** Asaas (cobrança via Pix/boleto/cartão) tende a ser melhor que Stripe pra clientes BR. Manter abstração para suportar ambos.
- **Fila de prioridade:** quando volume crescer, separar `sendWhatsAppMessage` em filas por instância (rate limit individual).
- **Vector DB:** começamos com pgvector. Se passar de ~1M itens por KB, considerar Qdrant em container separado.
- **Observabilidade:** Sentry + Grafana Cloud free tier no início; mover pra self-hosted se justificar.

---

## 12. Como retomar o trabalho numa próxima sessão

1. Abrir `C:\Users\marlo\projects\leadflow-ai` no editor.
2. Ler **seção 0** (estado atual) e **seção 11** (decisões pendentes).
3. Identificar fase em andamento (procurar TODOs `// Fase X` no código + checklists não marcados aqui).
4. Subir ambiente conforme **seção 1**.
5. Atacar a próxima fase pela ordem dos sub-itens. Cada sub-item tem critérios de aceite explícitos — não passar para o próximo sem checá-los.
6. Manter este documento atualizado: ao concluir um sub-item, marcar o checkbox. Ao tomar uma decisão pendente, mover para uma seção "decisões tomadas".

---

*Última atualização: 2026-05-20 — final da Fase 0.*
