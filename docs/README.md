# Documentação LeadFlow AI

Índice central. Comece por **[DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md)**.

---

## Por objetivo

| Quero… | Documento |
|--------|-----------|
| Visão geral + tudo que foi feito | [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) |
| Saber se o código está pronto | [SISTEMA-PRONTO.md](./SISTEMA-PRONTO.md) |
| Subir em produção (Hostinger VPS) | [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) |
| RebFlow em produção (rebflow.com.br) | [DEPLOY-REBFLOW-PROD.md](./DEPLOY-REBFLOW-PROD.md) |
| Configurar contas/serviços externos | [CONFIGURACAO-EXTERNA.md](./CONFIGURACAO-EXTERNA.md) |
| WhatsApp + Inbox + IA | [WHATSAPP-INBOX-IA.md](./WHATSAPP-INBOX-IA.md) |
| Calendário e agendamento | [AGENDAMENTO-CALENDARIO.md](./AGENDAMENTO-CALENDARIO.md) |
| Automações e n8n | [AUTOMACOES-N8N.md](./AUTOMACOES-N8N.md) |
| Histórico de desenvolvimento | [DESENVOLVIMENTO-LOG.md](./DESENVOLVIMENTO-LOG.md) |
| Roadmap original (referência) | [ROADMAP.md](./ROADMAP.md) |
| Status das fases | [PROXIMAS-FASES.md](./PROXIMAS-FASES.md) |

---

## Arquivos de infra no repositório

| Arquivo | Descrição |
|---------|-----------|
| `docker/docker-compose.yml` | Dev local (Postgres, Redis, Evolution) |
| `docker/docker-compose.prod.yml` | Produção (stack completa + Caddy) |
| `docker/Caddyfile` | HTTPS — editar domínios |
| `docker/.env.production.example` | Modelo `.env` na VPS |
| `scripts/vps-migrate.sh` | Migrations na VPS |
| `scripts/prisma-generate.ps1` | Prisma no Windows (EPERM) |
| `scripts/stop-leadflow-node.ps1` | Parar processos dev |
