#!/usr/bin/env bash
# Roda migrations DENTRO do container api (já tem Prisma + migrations + node_modules
# embutidos na imagem). Não baixa nada da internet — funciona mesmo com a rede
# interna sem acesso externo.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Crie .env na raiz (cp docker/.env.production.example .env)"
  exit 1
fi

COMPOSE="docker compose -f docker/docker-compose.prod.yml --env-file .env"

# Garante que o api está de pé (usa o DATABASE_URL já definido no container).
$COMPOSE up -d api

$COMPOSE exec -T api sh -c "cd /app && pnpm --filter @leadflow/database prisma migrate deploy"

echo "Migrations OK."
