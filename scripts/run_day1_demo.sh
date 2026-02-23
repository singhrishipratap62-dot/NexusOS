#!/usr/bin/env bash
set -euo pipefail

export SINGLE_TENANT_ID="${SINGLE_TENANT_ID:-tenant_day1}"

docker compose up -d postgres redis
pnpm install
pnpm --filter @nexus/api prisma:generate
pnpm --filter @nexus/api prisma:migrate
pnpm --filter @nexus/api seed
pnpm --filter @nexus/api dev &
pnpm --filter @nexus/workers dev &
pnpm --filter @nexus/web dev &
wait
