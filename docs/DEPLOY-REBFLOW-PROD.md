# Deploy produção — RebFlow (rebflow.com.br)

Documentação das correções aplicadas na VPS **2.24.116.70** para o stack Docker funcionar.

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
```

### Migrations (primeira vez)

```bash
./scripts/vps-migrate.sh
```

### Seed demo (opcional, só teste)

```bash
# Só se quiser demo@leadflow.ai na produção — não recomendado em cliente real
docker compose -f docker/docker-compose.prod.yml --env-file .env run --rm api ...
```

Melhor: **Criar conta** em `https://app.rebflow.com.br/signup`

---

## 7. Erros comuns

### Login: CORS + 502 no navegador

| Sintoma | Causa | Ação |
|---------|--------|------|
| **502** no `api.../login` | API container parado ou crash | `docker logs leadflow-prod-api-1` |
| **CORS error** | API down **ou** `APP_URL` errado no `.env` | Corrigir `.env`, rebuild **api** e **web** |
| Preflight 502 | Caddy sem backend | `docker ps` — api deve estar `Up` |

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
