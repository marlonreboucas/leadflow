# Deploy produção — RebFlow (rebflow.com.br)

> **Instalação do zero, passo a passo:** [INSTALACAO-VPS.md](./INSTALACAO-VPS.md) (guia repetível com todos os problemas resolvidos).
>
> Este arquivo detalha as **correções** aplicadas. Para subir um servidor novo, use o INSTALACAO-VPS.

Documentação das correções aplicadas na VPS para o stack Docker funcionar.

**DNS configurado:**

| Registro | Destino |
|----------|---------|
| `app.rebflow.com.br` | A → IP da VPS |
| `api.rebflow.com.br` | A → IP da VPS |
| `evo.rebflow.com.br` | A → IP da VPS |

---

## Segurança importante

Se senhas ou JWT foram expostos em chat/log, **gere novas** no `.env` da VPS e reinicie os containers.

**Nunca** commite o `.env` de produção no Git.

---

## 1. Arquivo `.env` (raiz do projeto na VPS)

Caminho típico: `/opt/leadflow/leadflow/.env`

Variáveis obrigatórias (valores reais só no servidor):

| Variável | Exemplo / nota |
|----------|----------------|
| `APP_URL` | `https://app.rebflow.com.br` |
| `API_URL` | `https://api.rebflow.com.br` |
| `WEBHOOK_PUBLIC_URL` | `https://api.rebflow.com.br` |
| `NEXT_PUBLIC_API_URL` | `https://api.rebflow.com.br` |
| `NEXT_PUBLIC_WS_URL` | `https://api.rebflow.com.br` |
| `NEXT_PUBLIC_EVOLUTION_URL` | `https://evo.rebflow.com.br` |
| `EVOLUTION_API_URL` | `http://evolution:8080` (**nome do serviço no compose**) |
| `EVOLUTION_PUBLIC_URL` | `https://evo.rebflow.com.br` |
| `DATABASE_URL` | host `postgres` (rede Docker), não `localhost` |
| `OPENAI_API_KEY` | chave válida da OpenAI |

Modelo: `docker/.env.production.example`

---

## 2. `docker/Caddyfile`

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

O serviço Evolution no compose prod chama-se **`evolution`** (porta 8080).

---

## 3. Dockerfiles (correções incorporadas no repo)

| Arquivo | Mudança |
|---------|---------|
| `Dockerfile.api` | `node:20-bookworm`, build de database, google-calendar, ai-runtime, automation |
| `Dockerfile.worker` | Idem + todos os packages do worker |
| `Dockerfile.web` | Bookworm, `node_modules` do web, sem pasta `/public` (não existe no projeto) |

---

## 4. Packages — `main` apontando para `dist`

| Pacote | `main` |
|--------|--------|
| `@leadflow/database` | `dist/index.js` |
| `@leadflow/google-calendar` | `dist/index.js` |

Necessário para `node apps/api/dist/main.js` em produção.

---

## 5. CORS na API

Arquivo: `apps/api/src/main.ts`

Origens permitidas via `.env`:

- `APP_URL`
- `API_URL`
- `http://localhost:3000` (dev)
- `CORS_ORIGINS` (opcional, vírgula)

Métodos: GET, POST, PUT, PATCH, DELETE, OPTIONS.

---

## 6. Comandos de produção (sempre na raiz do repo)

```bash
cd /opt/leadflow/leadflow

# Build limpo
docker compose -f docker/docker-compose.prod.yml --env-file .env build --no-cache

# Subir
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d

# Ou build + subir
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

**Não use** `docker compose up -d` sem `-f docker/docker-compose.prod.yml` — sobe o compose de **dev** errado.

### Verificar

```bash
docker ps
docker logs leadflow-prod-api-1 --tail 100
docker logs leadflow-prod-caddy-1 --tail 50
curl -s https://api.rebflow.com.br/health/ready
# Se 404, tente (build antigo): curl -s https://api.rebflow.com.br/api/health/ready
```

### Migrations (primeira vez) — método validado

Rodar **dentro do container da API** (mais rápido, já tem Prisma + schema):

```bash
docker exec -it leadflow-prod-api-1 \
  sh -c "cd /app && pnpm --filter @leadflow/database prisma migrate deploy"
```

Sem isso o login dá **500** (`table public.User does not exist`).

### Seed de base (roles + planos)

```bash
docker exec -it leadflow-prod-api-1 \
  sh -c "cd /app && pnpm --filter @leadflow/database exec tsx prisma/seed.ts"
```

Cria permissions, roles e planos. O **usuário demo NÃO é criado em produção** (`NODE_ENV=production`).

- **Produção:** criar conta em `https://app.rebflow.com.br/signup`
- **Demo forçado (teste):**
  ```bash
  docker exec -it -e NODE_ENV=development leadflow-prod-api-1 \
    sh -c "cd /app && pnpm --filter @leadflow/database exec tsx prisma/seed.ts"
  ```

### Testar login pela VPS

```bash
curl -sS -X POST https://api.rebflow.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@leadflow.ai","password":"demo1234"}'
```

Se **500**, veja o erro exato:

```bash
docker logs leadflow-prod-api-1 --tail 30
```

---

## 7. Erros comuns (todos já resolvidos nesta instalação)

| Sintoma | Causa | Ação |
|---------|--------|------|
| **502** no `api.../login` | API container parado/crash | `docker logs leadflow-prod-api-1` |
| **CORS error** | API down **ou** `APP_URL` errado | Corrigir `.env`, subir api |
| **P1000** | senha Postgres ≠ `.env` (volume antigo) | `ALTER USER leadflow WITH PASSWORD '...'` |
| **500** `table User does not exist` | migrations não rodaram | `prisma migrate deploy` no container api |
| **401** após seed | demo não existe em produção | signup ou seed com `NODE_ENV=development` |
| `/health/ready` **404** | prefixo `/api` | usar `/api/health/ready` |

Lista completa e comandos: [INSTALACAO-VPS.md §14](./INSTALACAO-VPS.md).

Ordem de diagnóstico:

```bash
curl https://api.rebflow.com.br/health/ready
docker compose -f docker/docker-compose.prod.yml --env-file .env ps
docker compose -f docker/docker-compose.prod.yml --env-file .env logs api --tail 80
```

Se `health/ready` falhar → corrigir API (Prisma, DATABASE_URL, JWT, build).

Depois de alterar `NEXT_PUBLIC_*` → rebuild **web**:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build web
```

### Evolution não conecta

- `EVOLUTION_API_URL=http://evolution:8080` (interno)
- `EVOLUTION_PUBLIC_URL=https://evo.rebflow.com.br`
- Caddy aponta `evo` → serviço `evolution:8080`

---

## 8. Checklist RebFlow produção

- [ ] DNS `app` / `api` / `evo` → IP VPS
- [ ] `.env` completo na VPS
- [ ] `docker/Caddyfile` com rebflow.com.br
- [ ] `docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build`
- [ ] `https://api.rebflow.com.br/health/ready` OK
- [ ] Login ou signup em `https://app.rebflow.com.br`
- [ ] WhatsApp QR em `/whatsapp`
- [ ] `OPENAI_API_KEY` preenchida

---

Ver também: [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) · [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md)
