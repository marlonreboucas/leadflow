# CI/CD — GitHub Actions

Dois workflows em `.github/workflows/`:

| Workflow | Arquivo | Dispara | Precisa de secrets? |
| --- | --- | --- | --- |
| **CI** | `ci.yml` | Todo push/PR na `main` | Não |
| **Deploy (VPS)** | `deploy.yml` | Manual (botão "Run workflow") | Sim |

---

## 1. CI (automático)

Roda a cada push/PR na `main`. Etapas: instala deps, gera Prisma Client, e roda
`typecheck`, `lint` e `build` de todo o monorepo (via Turborepo). Serve de "porteiro":
se algo quebra, você vê antes de subir pra produção. Não acessa a VPS nem usa segredos.

Nada a configurar — já funciona assim que os arquivos estiverem na `main`.

---

## 2. Deploy (manual)

Faz SSH na VPS e replica o processo manual atual:

```
git fetch + reset --hard origin/<branch>
pnpm deploy:prod:up        # build + up (docker-compose.prod.yml)
pnpm deploy:prod:migrate   # opcional (toggle)
pnpm deploy:prod:seed      # opcional (toggle)
```

> O build acontece **na VPS** (igual ao processo manual de hoje). É o caminho mais
> simples; se a VPS ficar apertada de recursos, dá pra migrar depois para build no
> Actions + GHCR (a VPS só faria `pull`).

### Pré-requisitos na VPS

- Docker + Docker Compose instalados.
- `pnpm` disponível no PATH do usuário do deploy (`corepack enable && corepack prepare pnpm@9.0.0 --activate`).
- Projeto já clonado em um diretório (ex.: `/opt/leadflow-ai`) com o `.env` de produção configurado.

### Variables e Secret do GitHub

Em **Settings → Secrets and variables → Actions**. Apenas a chave privada é
**Secret**; o resto são **Variables** (não-sensíveis). O workflow lê os não-sensíveis
de `vars.*` e a chave de `secrets.*`.

> Se usar **Environment** (`production`) em vez de repository-level, garanta que o
> nome do environment é exatamente `production` (igual ao `environment:` do
> `deploy.yml`), senão as variables não são encontradas.

Aba **Variables** → New variable:

| Variable | Obrigatório | Exemplo | Descrição |
| --- | --- | --- | --- |
| `VPS_HOST` | Sim | `2.24.116.70` | IP ou host da VPS |
| `VPS_USER` | Sim | `root` ou `deploy` | Usuário SSH |
| `VPS_PORT` | Não | `22` | Porta SSH (padrão 22) |
| `VPS_PROJECT_DIR` | Não | `/opt/leadflow-ai` | Caminho do projeto na VPS (padrão `/opt/leadflow-ai`) |

Aba **Secrets** → New secret:

| Secret | Obrigatório | Descrição |
| --- | --- | --- |
| `VPS_SSH_KEY` | Sim | Chave **privada** OpenSSH completa (com `-----BEGIN OPENSSH PRIVATE KEY-----`). Nunca a pública, nunca um placeholder. |

### Gerar a chave SSH para o deploy

No seu computador (ou em qualquer máquina):

```bash
ssh-keygen -t ed25519 -C "github-deploy-leadflow" -f leadflow_deploy -N ""
```

Isso cria `leadflow_deploy` (privada) e `leadflow_deploy.pub` (pública).

1. Adicione a **pública** na VPS (autoriza o acesso):

```bash
ssh-copy-id -i leadflow_deploy.pub <VPS_USER>@<VPS_HOST>
# ou manualmente:
cat leadflow_deploy.pub | ssh <VPS_USER>@<VPS_HOST> 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
```

2. Cole o conteúdo da **privada** (`leadflow_deploy`) no secret `VPS_SSH_KEY`.

> Segurança: use um usuário dedicado de deploy (não `root`) quando possível, e
> guarde a chave privada **apenas** no secret do GitHub. Nunca commite a chave.

### Rodar o deploy

GitHub → aba **Actions** → **Deploy (VPS)** → **Run workflow**. Você escolhe:

- **branch** (padrão `main`)
- **run_migrations** (padrão ✅) — roda `prisma migrate deploy`
- **run_seed** (padrão ❌) — roda seed de roles/planos (não recria o usuário demo em produção)

---

## Evolução futura (opcional)

- **Build no Actions + GHCR**: compilar as imagens no runner do GitHub, publicar no
  GitHub Container Registry e a VPS só fazer `docker compose pull && up -d`. Tira o
  peso do build da VPS e deixa o deploy mais rápido/atômico.
- **Deploy automático na main**: trocar `workflow_dispatch` por `push: branches: [main]`
  no `deploy.yml` (após confiar no CI). Recomendo manter manual até a Fase de pagamento estar estável.
- **Health check pós-deploy**: adicionar `curl` no endpoint `/api/health/ready` ao fim do deploy e falhar o job se não responder 200.
