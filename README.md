# NexusOS Day-1 Audit MVP

Single-tenant audit MVP for workflow opportunity discovery:
- Read-only Slack + Gmail ingestion (OAuth token path with fixture fallback for deterministic demo)
- Workflow extraction from last 30 days
- Feasibility + HLC + ROI scoring
- War Room ranked opportunities
- Human review gate for low-confidence recommendations

## Monorepo layout

- `apps/api` NestJS API + Prisma models/migrations
- `apps/workers` BullMQ workers
- `apps/web` Next.js War Room UI
- `packages/contracts` shared contract types + strict JSON schema
- `packages/shared` scoring/workflow/connectors utilities

## Quick start

1. `pnpm install`
2. `docker compose up -d postgres redis`
3. `pnpm --filter @nexus/api prisma:generate`
4. `pnpm --filter @nexus/api prisma:migrate`
5. `pnpm --filter @nexus/api seed`
6. `pnpm --filter @nexus/api dev`
7. `pnpm --filter @nexus/workers dev`
8. `pnpm --filter @nexus/web dev`

## Required tenant headers

Every API route requires:
- `Authorization: Bearer <AUTH_STATIC_TOKEN>`
- `x-tenant-id: tenant_day1`
- `x-actor-id: <user-or-service-id>`

## Key routes

- `GET /health`
- `POST /connectors/slack/sync`
- `POST /connectors/gmail/sync`
- `GET /connectors/slack/oauth/start`
- `POST /connectors/slack/oauth/exchange`
- `GET /connectors/gmail/oauth/start`
- `POST /connectors/gmail/oauth/exchange`
- `POST /pipeline/extract-and-score`
- `POST /pipeline/run-seeded`
- `GET /war-room/opportunities`
- `GET /review-queue`
- `POST /review-queue/:workflowId/decision`

## Smoke suite

Run the Day-1 smoke flow (ingest -> normalize -> workflow -> score -> dashboard ranking):

1. `docker compose up -d postgres redis`
2. `pnpm --filter @nexus/api prisma:migrate`
3. `pnpm test:smoke`
