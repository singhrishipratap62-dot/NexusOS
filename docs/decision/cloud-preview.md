# Cloud Preview Setup

## Web (Vercel)

- Root directory: `apps/web`
- Install command: `pnpm install`
- Build command: `pnpm --filter @nexus/web build`
- Required environment variables:
  - `API_BASE_URL=https://<railway-api-domain>`
  - `SINGLE_TENANT_ID=tenant_day1`
  - `NEXT_PUBLIC_API_BASE_URL=https://<railway-api-domain>`
  - `NEXT_PUBLIC_TENANT_ID=tenant_day1`

## API (Railway)

- Service root: repository root (uses `apps/api/railway.json`)
- Required variables:
  - `PORT=3000`
  - `DATABASE_URL=<railway-postgres-url>`
  - `REDIS_URL=<railway-redis-url>`
  - `SINGLE_TENANT_ID=tenant_day1`
  - `BLENDED_HOURLY_RATE=95`
  - `IMPLEMENTATION_COST_DEFAULT=18000`
  - `ANNUAL_PLATFORM_COST=4800`
  - `ENABLE_LLM_RATIONALE=true`

## Workers (Railway)

- Service root: repository root (uses `apps/workers/railway.json`)
- Required variables:
  - `DATABASE_URL=<railway-postgres-url>`
  - `REDIS_URL=<railway-redis-url>`
  - `SINGLE_TENANT_ID=tenant_day1`

## Managed Dependencies

- Add PostgreSQL and Redis in the same Railway project.
- Run Prisma migrations after API deployment:
  - `pnpm --filter @nexus/api prisma:migrate`
