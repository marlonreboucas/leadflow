# Instalação do zero — LeadFlow/RebFlow em VPS

Guia **repetível** para subir o sistema em qualquer VPS Ubuntu (Hostinger KVM2 ou similar), validado em produção (`rebflow.com.br`).

> Este guia já inclui todos os problemas reais encontrados e suas soluções. Siga na ordem.

---

## 0. Pré-requisitos

| Item | Detalhe |
|------|---------|
| VPS | Ubuntu 22.04/24.04, **8 GB RAM** (KVM2) |
| Acesso | `ssh root@IP_DA_VPS` |
| Domínio | 3 subdomínios apontando para o IP |
| GitHub | repositório do projeto acessível |
| OpenAI | chave `sk-...` (para IA) |

---

## 1. DNS (no painel do domínio)

Registros **A** → IP da VPS:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `app` | IP_DA_VPS |
| A | `api` | IP_DA_VPS |
| A | `evo` | IP_DA_VPS |
| A | `@`  | IP_DA_VPS (opcional) |
| CNAME | `www` | seudominio.com.br |

---

## 2. Preparar a VPS

```bash
ssh root@IP_DA_VPS

apt update && apt upgrade -y
apt install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

**Não** abra 5432 (Postgres) nem 6379 (Redis).

---

## 3. Clonar o projeto

```bash
mkdir -p /opt/leadflow && cd /opt/leadflow
git clone https://github.com/SEU_USUARIO/leadflow-ai.git leadflow
cd /opt/leadflow/leadflow
```

> O caminho final fica `/opt/leadflow/leadflow`. Todos os comandos abaixo rodam daí.

---

## 4. Configurar `.env`

```bash
cp docker/.env.production.example .env
nano .env
```

Preencha (exemplo RebFlow — troque domínios e senhas):

```env
NODE_ENV=production
TZ=America/Sao_Paulo

POSTGRES_USER=leadflow
POSTGRES_PASSWORD=senha_forte_unica
POSTGRES_DB=leadflow
DATABASE_URL=postgresql://leadflow:senha_forte_unica@postgres:5432/leadflow?schema=public

REDIS_URL=redis://redis:6379
API_PORT=3001

APP_URL=https://app.rebflow.com.br
API_URL=https://api.rebflow.com.br
WEBHOOK_PUBLIC_URL=https://api.rebflow.com.br
NEXT_PUBLIC_API_URL=https://api.rebflow.com.br
NEXT_PUBLIC_WS_URL=https://api.rebflow.com.br
NEXT_PUBLIC_EVOLUTION_URL=https://evo.rebflow.com.br

JWT_SECRET=string_aleatoria_min_32
JWT_REFRESH_SECRET=outra_string_aleatoria_min_32

EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_API_KEY=chave_evolution_forte
EVOLUTION_PUBLIC_URL=https://evo.rebflow.com.br

OPENAI_API_KEY=sk-sua-chave
OPENAI_DEFAULT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

> **Regra de ouro:** `POSTGRES_PASSWORD` e a senha dentro de `DATABASE_URL` devem ser **idênticas**. `DATABASE_URL` usa host **`postgres`**, não `localhost`.

Salvar no nano: **Ctrl+O** → Enter → **Ctrl+X**.

---

## 5. Caddy (HTTPS)

```bash
nano docker/Caddyfile
```

```caddy
app.rebflow.com.br {
	reverse_proxy web:3000
}
api.rebflow.com.br {
	reverse_proxy api:3001
}
evo.rebflow.com.br {
	reverse_proxy evolution:8080
}
```

Troque os domínios pelos seus.

---

## 6. Subir o stack

```bash
cd /opt/leadflow/leadflow
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

> **Sempre** com `-f docker/docker-compose.prod.yml`. Sem isso o Docker usa o compose de **dev**.

Primeira build: 10–20 min. Verifique:

```bash
docker ps
# Devem aparecer: postgres, redis, evolution, api, worker, web, caddy
```

---

## 7. Migrations (criar tabelas) — OBRIGATÓRIO

Sem isso o login dá **500** (`table public.User does not exist`).

```bash
docker exec -it leadflow-prod-api-1 \
  sh -c "cd /app && pnpm --filter @leadflow/database prisma migrate deploy"
```

Esperado: `All migrations have been successfully applied.`

Conferir:

```bash
docker exec -it leadflow-prod-postgres-1 psql -U leadflow -d leadflow -c "\dt"
```

Deve listar `User`, `Company`, `Plan`, `Role`, `Deal`, etc.

---

## 8. Seed de base (roles + planos) — OBRIGATÓRIO

Sem roles/planos o **signup e login dão erro**.

```bash
docker exec -it leadflow-prod-api-1 \
  sh -c "cd /app && pnpm --filter @leadflow/database exec tsx prisma/seed.ts"
```

Cria: permissions, roles do sistema, planos.

> **Importante:** o usuário demo (`demo@leadflow.ai`) **só** é criado quando `NODE_ENV != production`. Em produção o seed **não** cria demo (correto). Use signup (passo 9).

### (Opcional) Forçar usuário demo em produção

Só para teste rápido:

```bash
docker exec -it -e NODE_ENV=development leadflow-prod-api-1 \
  sh -c "cd /app && pnpm --filter @leadflow/database exec tsx prisma/seed.ts"
```

Login: `demo@leadflow.ai` / `demo1234`

---

## 9. Criar sua conta (produção)

Abra **https://app.rebflow.com.br/signup** e crie usuário + empresa.

Ou por curl:

```bash
curl -sS -w "\nHTTP %{http_code}\n" -X POST https://api.rebflow.com.br/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Seu Nome","email":"voce@rebflow.com.br","password":"SenhaForte123","companyName":"RebFlow"}'
```

**HTTP 200/201** + `accessToken` = funcionando.

---

## 10. OpenAI (IA)

Já no `.env` (passo 4). Para alterar/adicionar depois:

```bash
nano .env       # OPENAI_API_KEY=sk-...
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d api worker
docker exec leadflow-prod-api-1 printenv OPENAI_API_KEY   # confere
```

A chave é **runtime** — não precisa rebuild, só recriar `api` e `worker`.

---

## 11. WhatsApp (Evolution)

1. Login no app → **WhatsApp** (`/whatsapp`)
2. Criar instância → escanear **QR** (ou `https://evo.rebflow.com.br/manager`)
3. **Sincronizar webhook** (usa `WEBHOOK_PUBLIC_URL`)
4. Enviar mensagem teste → aparece no **Inbox**

---

## 12. Validação final

```bash
curl -sS https://api.rebflow.com.br/api/health/ready
# {"status":"ready","checks":{"postgres":"ok","redis":"ok","evolution":"ok"}}
```

| URL | Esperado |
|-----|----------|
| `https://app.rebflow.com.br/login` | Login |
| `https://api.rebflow.com.br/api/health/ready` | ready |
| `/whatsapp` | QR |

---

## 13. Atualizar (deploy de novo código)

No PC:

```bash
git add . && git commit -m "..." && git push
```

Na VPS:

```bash
cd /opt/leadflow/leadflow
git pull
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build

# Se houver migration nova:
docker exec -it leadflow-prod-api-1 sh -c "cd /app && pnpm --filter @leadflow/database prisma migrate deploy"
```

---

## 14. Problemas encontrados e soluções (histórico real)

| # | Sintoma | Causa | Solução |
|---|---------|-------|---------|
| 1 | SSH `Permission denied` | senha não definida / só chave | Reset senha root no painel; `ssh -o PreferredAuthentications=password` |
| 2 | Build falhava (`alpine`) | libs nativas Prisma | Dockerfiles em `node:20-bookworm` |
| 3 | API import `@leadflow/database` falha | `main` apontava para `src` | `main: dist/index.js` + build dos packages |
| 4 | Login **502** + CORS | API container caído | Subir API; CORS lê `APP_URL`/`API_URL` |
| 5 | API crash **P1000** | senha Postgres ≠ `.env` (volume antigo) | `ALTER USER leadflow WITH PASSWORD '...'` igual ao `.env` |
| 6 | `/health/ready` **404** | prefixo global `/api` | rota correta `/api/health/ready` (fix no `main.ts` aplica `/health`) |
| 7 | Login **500** `table User does not exist` | migrations não rodaram | passo 7 (migrate deploy) |
| 8 | Login **401** após seed | demo não criado em produção | signup (passo 9) ou seed forçado |
| 9 | `docker compose up` sobe stack errado | faltou `-f ...prod.yml` | sempre usar o arquivo prod |

### Senha do Postgres divergente (erro 5)

Se trocar `POSTGRES_PASSWORD` depois do volume já criado:

```bash
docker exec -it leadflow-prod-postgres-1 \
  psql -U leadflow -d leadflow -c "ALTER USER leadflow WITH PASSWORD 'mesma_senha_do_env';"
docker compose -f docker/docker-compose.prod.yml --env-file .env restart api worker
```

Ou recriar do zero (apaga dados):

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env down
docker volume rm leadflow-prod_postgres_data
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
# refazer passos 7 e 8
```

---

## 15. Segurança

- **Nunca** commitar `.env` real (senhas, JWT, OpenAI, Evolution).
- Se algum segredo vazar (chat, log, print) → **revogar/rotacionar**.
- Bots scaneiam `/api/.env` etc. — normal em VPS pública; retorna 404.
- Limite de gasto na OpenAI.
- Backup diário do Postgres (cron ou backup gerenciado da Hostinger).

---

## 16. Comandos atalho (`package.json`)

| Comando | Ação |
|---------|------|
| `pnpm deploy:prod:up` | build + up (prod) |
| `pnpm deploy:prod:build` | build --no-cache |
| `pnpm deploy:prod:migrate` | migrations via script |
| `pnpm deploy:prod:seed` | seed via script |

> Os scripts `scripts/vps-*.sh` usam um container Node temporário. Se preferir, use os `docker exec` diretos dos passos 7 e 8 (mais rápidos, usam o container `api` já pronto).

---

Ver também: [DEPLOY-REBFLOW-PROD.md](./DEPLOY-REBFLOW-PROD.md) · [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) · [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md)
