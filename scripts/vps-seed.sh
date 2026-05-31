#!/usr/bin/env bash
# Seed (roles/planos) DENTRO do container api. Não baixa nada da internet.
# Em produção (NODE_ENV=production no container) o seed cria roles/planos, mas
# NÃO cria o usuário demo — crie a conta via /signup.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Crie .env na raiz"
  exit 1
fi

COMPOSE="docker compose -f docker/docker-compose.prod.yml --env-file .env"

$COMPOSE up -d api

$COMPOSE exec -T api sh -c "cd /app && pnpm --filter @leadflow/database exec tsx prisma/seed.ts"

echo "Seed OK."
