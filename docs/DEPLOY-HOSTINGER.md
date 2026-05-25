# Deploy LeadFlow na Hostinger VPS — passo a passo

Guia para subir **tudo em uma VPS** (recomendado **KVM 8 GB RAM**, Ubuntu 22/24):

- Postgres + Redis  
- Evolution API (WhatsApp)  
- API + Worker + Web  
- HTTPS automático (Caddy)

**n8n não é obrigatório** — configure depois se quiser.

---

## 1. Contratar a VPS na Hostinger

1. Acesse [Hostinger VPS](https://www.hostinger.com.br/vps) e escolha **KVM VPS** com **8 GB RAM** (mínimo aceitável: 4 GB, apertado).
2. Sistema operacional: **Ubuntu 24.04** (ou 22.04).
3. Anote o **IP público** da VPS.
4. Defina senha root ou chave SSH no painel.

---

## 2. Domínio e DNS

No painel da Hostinger (ou onde estiver o domínio), crie registros **A**:

| Subdomínio | Tipo | Valor |
|------------|------|--------|
| `app` | A | IP da VPS |
| `api` | A | IP da VPS |
| `evo` | A | IP da VPS |

Exemplo:

- `app.seudominio.com.br` → app (Next.js)  
- `api.seudominio.com.br` → API + WebSocket  
- `evo.seudominio.com.br` → Evolution (QR / manager)

Propagação DNS: 5 min a 48 h (geralmente &lt; 1 h).

---

## 3. Primeiro acesso SSH

No Windows (PowerShell) ou Mac:

```bash
ssh root@SEU_IP_DA_VPS
```

Atualize o sistema:

```bash
apt update && apt upgrade -y
apt install -y git curl ca-certificates
```

---

## 4. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Instale o plugin Compose:

```bash
apt install -y docker-compose-plugin
docker compose version
```

---

## 5. Firewall (portas 80 e 443)

Na Hostinger (hPanel → VPS → Firewall) ou via UFW:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

**Não** exponha Postgres (5432) nem Redis (6379) na internet.

---

## 6. Clonar o projeto (GitHub)

```bash
mkdir -p /opt/leadflow && cd /opt/leadflow
git clone https://github.com/SEU_USUARIO/leadflow-ai.git .
```

Substitua pela URL do **seu** repositório.

---

## 7. Arquivo `.env` de produção

```bash
cp docker/.env.production.example .env
nano .env
```

Altere **todos** os `CHANGE_ME` e `seudominio.com`:

| Variável | Exemplo |
|----------|---------|
| `POSTGRES_PASSWORD` | senha longa aleatória |
| `APP_URL` | `https://app.seudominio.com.br` |
| `API_URL` | `https://api.seudominio.com.br` |
| `WEBHOOK_PUBLIC_URL` | `https://api.seudominio.com.br` |
| `NEXT_PUBLIC_API_URL` | `https://api.seudominio.com.br` |
| `NEXT_PUBLIC_WS_URL` | `https://api.seudominio.com.br` |
| `NEXT_PUBLIC_EVOLUTION_URL` | `https://evo.seudominio.com.br` |
| `EVOLUTION_PUBLIC_URL` | `https://evo.seudominio.com.br` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | 32+ caracteres aleatórios |
| `EVOLUTION_API_KEY` | mesma chave que usará na Evolution |
| `OPENAI_API_KEY` | `sk-...` da OpenAI |

Salve: `Ctrl+O`, Enter, `Ctrl+X`.

---

## 8. Caddy (HTTPS) — editar domínios

```bash
nano docker/Caddyfile
```

Troque os domínios pelos seus subdomínios reais. Exemplo **RebFlow** já no repo:

- `app.rebflow.com.br` → `web:3000`
- `api.rebflow.com.br` → `api:3001`
- `evo.rebflow.com.br` → `evolution:8080` (serviço chama-se `evolution` no compose prod)

**Produção RebFlow (correções Docker/CORS):** [DEPLOY-REBFLOW-PROD.md](./DEPLOY-REBFLOW-PROD.md)

---

## 9. Subir banco e rodar migrations

```bash
cd /opt/leadflow
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d postgres redis
sleep 15
```

Migrations (uma vez, na primeira instalação):

```bash
chmod +x scripts/vps-migrate.sh
./scripts/vps-migrate.sh
```

**Seed (só ambiente demo — opcional):**

```bash
# Não rode em produção real com clientes
# pnpm db:seed
```

---

## 10. Build e subir todos os serviços

```bash
cd /opt/leadflow/leadflow
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

**Sempre** use `-f docker/docker-compose.prod.yml` (sem isso sobe o compose de dev).

Rebuild se login der 502/CORS:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env build --no-cache
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d
```

A primeira build pode levar **10–20 minutos**.

Verifique:

```bash
docker compose -f docker/docker-compose.prod.yml ps
docker compose -f docker/docker-compose.prod.yml logs -f api --tail 50
```

---

## 11. Testar no navegador

| URL | Esperado |
|-----|----------|
| `https://api.seudominio.com.br/health/ready` | JSON com postgres + redis ok |
| `https://app.seudominio.com.br/login` | Tela de login |
| `https://evo.seudominio.com.br/manager` | Evolution Manager (QR) |

Crie conta em **Cadastro** ou use seed se rodou.

---

## 12. Conectar WhatsApp (Evolution)

1. Login no LeadFlow → **WhatsApp** (`/whatsapp`).
2. Crie instância e escaneie o **QR** (ou abra `https://evo.../manager`).
3. Clique em **Sincronizar webhook** (usa `WEBHOOK_PUBLIC_URL`).
4. Envie mensagem de teste para o número conectado → deve aparecer no **Inbox**.

No `.env` da VPS, `EVOLUTION_API_KEY` deve ser **igual** à chave configurada na Evolution.

---

## 13. Agente IA

1. **Agentes** → ative um agente (modo FULL_AUTO ou SUGGEST).
2. Confirme `OPENAI_API_KEY` no `.env`.
3. Reinicie worker se alterou a chave:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env restart worker api
```

---

## 14. Atualizar o sistema (deploy novo código)

```bash
cd /opt/leadflow
git pull
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker/docker-compose.prod.yml --env-file .env exec api true
# Se houver migration nova:
pnpm db:migrate:deploy   # ou repita o passo 9
```

---

## 15. Backup Postgres (recomendado)

Cron diário (exemplo):

```bash
crontab -e
```

```cron
0 3 * * * docker exec leadflow-prod-postgres-1 pg_dump -U leadflow leadflow | gzip > /root/backups/leadflow-$(date +\%F).sql.gz
```

Crie `/root/backups` antes.

---

## 16. n8n (opcional, depois)

**Não** precisa estar na mesma VPS no dia 1.

1. Suba n8n (outro plano Hostinger, n8n Cloud ou container separado).
2. Workflow com nó Webhook POST.
3. LeadFlow → **Integrações → n8n** → cadastre URL e eventos.

Ver [AUTOMACOES-N8N.md](./AUTOMACOES-N8N.md).

---

## Checklist rápido

- [ ] VPS 8 GB + Ubuntu  
- [ ] DNS `app` / `api` / `evo` → IP da VPS  
- [ ] `.env` produção preenchido  
- [ ] `docker/Caddyfile` com domínios corretos  
- [ ] `docker compose ... up -d --build`  
- [ ] `/health/ready` OK  
- [ ] WhatsApp QR + webhook  
- [ ] OpenAI configurada  
- [ ] Backup Postgres  

---

## Problemas comuns

| Sintoma | Solução |
|---------|---------|
| Web sem API | `NEXT_PUBLIC_*` errado — refaça build do `web` após corrigir `.env` |
| Evolution não chama webhook | `WEBHOOK_PUBLIC_URL` deve ser URL pública da API (https) |
| Certificado SSL | DNS propagado? Caddy precisa das portas 80/443 abertas |
| Worker “noeviction” | Redis em prod já usa `noeviction` no compose prod |
| EPERM Prisma local | Só no Windows dev — na VPS use Docker build |

---

## O que a Hostinger VPS cobre

| Serviço | Na VPS |
|---------|--------|
| LeadFlow (API, Worker, Web) | ✅ |
| Postgres + Redis | ✅ |
| Evolution WhatsApp | ✅ |
| HTTPS (Caddy) | ✅ |
| OpenAI | Conta externa (API key) |
| n8n | Opcional, outro lugar |
| Stripe | Opcional |

Ver também: [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md) · [SISTEMA-PRONTO.md](./SISTEMA-PRONTO.md)
