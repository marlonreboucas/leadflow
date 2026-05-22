#!/usr/bin/env bash
# Roda migrations na VPS (Postgres já up via docker-compose.prod.yml)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Crie .env na raiz (cp docker/.env.production.example .env)"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

NETWORK="${COMPOSE_PROJECT_NAME:-leadflow-prod}_internal"
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "Rede $NETWORK não existe. Suba postgres antes:"
  echo "  docker compose -f docker/docker-compose.prod.yml --env-file .env up -d postgres redis"
  exit 1
fi

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-leadflow}?schema=public"

docker run --rm \
  --network "$NETWORK" \
  -v "$(pwd):/app" \
  -w /app \
  -e DATABASE_URL \
  node:20-bookworm-slim \
  bash -c "
    apt-get update -qq && apt-get install -y -qq openssl ca-certificates >/dev/null
    corepack enable && corepack prepare pnpm@9.0.0 --activate
    pnpm install --frozen-lockfile
    pnpm db:migrate:deploy
  "

echo "Migrations OK."
