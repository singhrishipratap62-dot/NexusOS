# Day-1 Smoke Checklist — NexusOS Audit MVP

Executable step-by-step runbook. Every `curl` command is copy-paste ready.
Run from the repo root. Expected outputs are listed after each step.

---

## Prerequisites

```bash
# 1. Copy env file (already done if .env exists)
cp .env.example .env          # only needed once

# 2. Install dependencies
pnpm install

# 3. Start Postgres + Redis
docker compose up -d postgres redis

# 4. Wait for healthy (usually < 15 s)
docker compose ps             # postgres and redis should show "(healthy)"
```

---

## Path A — Local dev (no Docker for app services)

### Step 1: Migrate + Seed

```bash
pnpm --filter @nexus/api prisma:generate
pnpm --filter @nexus/api prisma:migrate
pnpm --filter @nexus/api seed
```

**Expected output**:
```
Seed complete {
  "slack": { "ingested": 36, "duplicates": 0, "normalized": 36, "malformed": 0 },
  "gmail": { "ingested": 36, "duplicates": 0, "normalized": 36, "malformed": 0 },
  "workflows": 1,
  "reviewQueued": 0
}
```
> `workflows: 1` = "Customer Escalation Resolution" extracted from 18 fixture runs.
> `reviewQueued: 0` = confidence ≥ 0.70, auto-approved.

### Step 2: Start services

```bash
pnpm --filter @nexus/api dev &
pnpm --filter @nexus/workers dev &
pnpm --filter @nexus/web dev &
```

Or use the one-liner: `bash scripts/run_day1_demo.sh`

### Step 3: Health check

```bash
curl -s http://localhost:3000/health \
  -H "Authorization: Bearer day1-mvp-token" \
  -H "x-tenant-id: tenant_day1" \
  -H "x-actor-id: smoke-test" | jq .
```

**Expected**:
```json
{ "status": "ok", "timestamp": "..." }
```

### Step 4: War Room opportunities

```bash
curl -s "http://localhost:3000/war-room/opportunities?includeNeedsReview=true&sortBy=priority&sortDir=desc&limit=10" \
  -H "Authorization: Bearer day1-mvp-token" \
  -H "x-tenant-id: tenant_day1" \
  -H "x-actor-id: smoke-test" | jq .
```

**Expected**: Array with at least 1 item. First item must include:
```json
{
  "workflowName": "Customer Escalation Resolution",
  "recommendationStatus": "RECOMMENDED",
  "reviewStatus": "AUTO_APPROVED",
  "feasibilityScore": ...,
  "annualLaborCost": ...,
  "roiScore": ...
}
```

### Step 5: Review queue (should be empty after clean seed)

```bash
curl -s "http://localhost:3000/review-queue" \
  -H "Authorization: Bearer day1-mvp-token" \
  -H "x-tenant-id: tenant_day1" \
  -H "x-actor-id: smoke-test" | jq .
```

**Expected**: `[]` — no items pending review (all auto-approved at default fixture confidence).

### Step 6: Trigger manual sync + re-score (idempotency check)

```bash
# Queue a Slack sync — will use fixture fallback (no OAuth token set)
curl -s -X POST "http://localhost:3000/connectors/slack/sync" \
  -H "Authorization: Bearer day1-mvp-token" \
  -H "x-tenant-id: tenant_day1" \
  -H "x-actor-id: smoke-test" | jq .
```

**Expected**: `{ "syncJobId": "...", "queueJobId": "...", "mode": "QUEUED" or "INLINE_FALLBACK" }`

Wait 3–5 seconds, then re-run Step 4. Opportunity count and scores must be **identical** — idempotency confirmed.

### Step 7: Analyst review decision (manual gate test)

```bash
# First, get a workflowId from Step 4 output:
WORKFLOW_ID="<paste workflowId from step 4>"

curl -s -X POST "http://localhost:3000/review-queue/${WORKFLOW_ID}/decision" \
  -H "Authorization: Bearer day1-mvp-token" \
  -H "x-tenant-id: tenant_day1" \
  -H "x-actor-id: analyst-alice" \
  -H "Content-Type: application/json" \
  -d '{"decision":"APPROVE","reason":"Manual review passed"}' | jq .
```

**Expected**:
```json
{
  "workflowId": "...",
  "recommendationStatus": "RECOMMENDED",
  "reviewStatus": "APPROVED"
}
```

### Step 8: Run automated test suite

```bash
# Unit + integration tests (uses in-memory Prisma — no DB needed)
pnpm --filter @nexus/shared test
pnpm --filter @nexus/api test

# Smoke flow only (fast subset)
pnpm test:smoke
```

**Expected**: All tests pass. `smoke-flow.test.ts` confirms end-to-end ingest → War Room → idempotency.

### Step 9: UI check

Open `http://localhost:3001` in a browser.

- [ ] War Room table renders with at least 1 row
- [ ] "Customer Escalation Resolution" appears with green feasibility score
- [ ] Filter tabs work (All / Recommended / Needs Review)
- [ ] Sort direction toggle works
- [ ] `PENDING_REVIEW` items (if any) are clearly distinguished

---

## Path B — Full Docker stack

```bash
docker compose up --build
```

`migrate-seed` service runs automatically before `api` starts (dependency chain in `docker-compose.yml`).
Wait for all services to show `(healthy)` or `(started)`:

```bash
docker compose ps
```

Then run Steps 3–9 above, using `http://localhost:3000` (API) and `http://localhost:3001` (UI).

---

## Pass / Fail Criteria

| Check | Pass condition |
|-------|---------------|
| Health endpoint | HTTP 200, `status: ok` |
| War Room opportunities | ≥ 1 item, workflowName present |
| Seed idempotency | Second seed: `ingested: 0`, `duplicates: 36+` each provider |
| Review gate | `confidence < 0.70` item → `PENDING_REVIEW`, blocked from `RECOMMENDED` |
| Analyst decision | `APPROVE` → `reviewStatus: APPROVED`, `REJECT` → `REJECTED` |
| Automated tests | 0 failures across `@nexus/shared` and `@nexus/api` |
| UI render | War Room table visible, filters responsive |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `prisma:migrate` fails | Postgres not ready | `docker compose ps`, wait for `(healthy)` |
| `seed` outputs `workflows: 0` | Events older than 30 days in fixtures | Fixtures use `daysAgo()` relative to `Date.now()` — always fresh |
| War Room returns `[]` | `extractAndScore` not run | Run `POST /pipeline/run-seeded` or re-run seed |
| Workers won't start | Redis not ready | `docker compose up -d redis && sleep 5` |
| Auth errors on curl | Missing headers | All three headers required: `Authorization`, `x-tenant-id`, `x-actor-id` |
| `INLINE_FALLBACK` mode | Redis unavailable | Expected in dev without Redis — pipeline runs synchronously instead |
