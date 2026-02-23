# NexusOS Day-1 Prompt Pack (90% Codex / 10% Claude)

## 0) Scope Lock (Non-negotiable)
Build only an **Audit MVP** in 24h:
- Single-tenant
- Read-only connectors: Slack + Gmail
- Last 30 days data
- Workflow extraction
- HLC + Feasibility + ROI scoring
- One War Room page with ranked opportunities
- Human review gate for low-confidence items

Out of scope for Day-1:
- Agent runtime/deployment
- Write-back actions to SaaS tools
- Multi-tenant production hardening
- Full local-first enterprise mode

## 1) Collaboration Model (Hard Split)
- **Codex = 90%** (primary builder + integration owner)
- **Claude = 10%** (high-leverage quality artifacts, minimal code edits)

### Ownership Rules
- Codex owns all implementation paths by default.
- Claude can only edit:
  - `/Users/rishi/Documents/NexusOS/evals/*`
  - `/Users/rishi/Documents/NexusOS/docs/qa/*`
  - `/Users/rishi/Documents/NexusOS/docs/decision/*`
- Claude does **not** edit runtime code unless explicitly reassigned.
- Merge every 90 minutes into one integration branch (owned by Codex).

## 1.1) Locked Tech Choices (Decided)
- Backend framework: **NestJS (TypeScript)**.
- Job system: **BullMQ + Redis**.
- Database access/migrations: **Prisma + PostgreSQL**.
- Cloud preview target: **Vercel (web) + Railway (API/workers/Postgres/Redis)**.
- Claude runtime edit policy: only if Codex is blocked and you explicitly reassign one scoped ticket.

## 2) Quick Run Order
1. Codex runs bootstrap and executes CDX tickets in order.
2. Claude runs bootstrap and completes CLD tickets in parallel (non-blocking).
3. Codex integrates Claude artifacts, runs full smoke tests, and publishes go/no-go.

## 3) Codex Bootstrap Prompt
```text
You are the primary implementation owner for NexusOS Day-1 MVP in /Users/rishi/Documents/NexusOS.

Mission:
Ship an audit-only MVP in 24 hours with strict scope:
- Single-tenant
- Read-only Slack + Gmail connectors
- Workflow extraction (last 30 days)
- HLC + Feasibility + ROI scoring
- War Room page with ranked opportunities
- Human review gate for low-confidence outputs

Collaboration context:
- Claude is being used with strict usage limits and only contributes ~10% effort.
- Treat Claude outputs as optional quality accelerators, not blockers.
- You own integration and all runtime code.

Rules:
1) Implement quickly with stable module boundaries.
2) No unrelated refactors.
3) Enforce tenant scope and audit trail on all APIs.
4) Validate all model outputs with strict JSON schema.
5) Add tests for changed behavior.
6) Report exact commands run.
7) Use NestJS for backend, BullMQ for jobs, Prisma for DB schema/migrations.
8) Prepare cloud preview deploy for Vercel (web) and Railway (api/workers/db/redis).

Return format (every run):
1. Summary
2. Changed files (absolute paths)
3. Commands run
4. Test results
5. Known risks/blockers
```

## 4) Claude Initial Context Prompt (10% Usage Budget)
```text
You are a supporting coding agent for NexusOS in /Users/rishi/Documents/NexusOS.

Project context:
NexusOS is an AI Business Operating System. Day-1 goal is an Audit MVP:
- Read-only Slack + Gmail ingestion
- Workflow extraction
- HLC + Feasibility + ROI outputs
- War Room recommendations
- Human review for low-confidence

Team setup:
- Codex is the primary builder and integration owner.
- You are intentionally limited to ~10% of total project effort due usage limits.
- Your work must be high-leverage and non-blocking.

Your allowed edit scope:
- /Users/rishi/Documents/NexusOS/evals/*
- /Users/rishi/Documents/NexusOS/docs/qa/*
- /Users/rishi/Documents/NexusOS/docs/decision/*

Do not edit runtime services unless Codex is blocked and you are explicitly reassigned one scoped ticket.
Do not refactor unrelated files.
Keep outputs concise and deterministic.

Priority order (stop after finishing in order if usage is tight):
1) Create feasibility and workflow evaluation fixtures.
2) Create prompt-injection/adversarial test cases for audit pipeline.
3) Produce concise scoring calibration guidance with thresholds.

Return format:
1) Summary
2) Changed files (absolute paths)
3) Commands run
4) Test/validation output
5) Risks/assumptions
```

## 5) Day-1 Tickets (Redefined)

### Codex Tickets (Primary, ~90%)

#### CDX-00 (0.75h) Contracts + Project Bootstrap
- Create monorepo skeleton (`apps/api`, `apps/web`, `apps/workers`, `packages/contracts`, `packages/shared`).
- Add base scripts for build/test/lint.
- Add `.env.example` templates.
- Use NestJS in `apps/api` and BullMQ-ready worker setup in `apps/workers`.
- Done when all projects compile and a health endpoint is live.

#### CDX-01 (0.75h) Auth + Tenant Guardrails
- Add auth middleware and tenant-scoped request context.
- Reject cross-tenant access.
- Done when tenant isolation tests pass.

#### CDX-02 (1.25h) Database Migrations
- Create schema for: tenants, connectors, sync_jobs, raw_events, normalized_events, workflows, nodes, edges, hlc_estimates, feasibility_scores, roi_simulations, review_queue, audit_events.
- Add indexes on tenant/time/workflow dimensions.
- Done when migrations up/down are clean.

#### CDX-03 (2.0h) Slack Read-Only Connector
- OAuth token usage, pagination, retries/backoff, checkpointing.
- Idempotent raw event ingestion by hash.
- Done when sync job status lifecycle works end-to-end.

#### CDX-04 (2.0h) Gmail Read-Only Connector
- Incremental sync with checkpoints.
- Retry-safe resume.
- Deduped insert behavior.
- Done when sync is resumable and idempotent.

#### CDX-05 (1.75h) Ingestion + Normalization
- Canonical normalized event schema mapping for Slack/Gmail.
- Handle malformed payloads gracefully and capture failure reason.
- Done when normalized events are emitted for both providers.

#### CDX-06 (2.0h) Workflow DAG Engine (Deterministic v1)
- Build recurring workflow clusters.
- Generate workflow nodes/edges + actor/tool attribution.
- Confidence score computed deterministically.
- Done when fixture dataset yields stable DAG output.

#### CDX-07 (1.5h) Feasibility Scoring v1
- Deterministic subscores + weighted final score.
- Optional LLM rationale in strict JSON schema; fail closed if invalid.
- Done when scorer outputs persist with confidence.

#### CDX-08 (1.5h) HLC + ROI Engine
- Deterministic formulas for annual labor cost, net savings, payback months.
- Done when formula tests pass and outputs are persisted.

#### CDX-09 (1.0h) Review Queue + Gating
- Route confidence < 0.70 to `NEEDS_REVIEW`.
- Analyst approve/reject endpoint with reason.
- Done when low-confidence never appears as recommended.

#### CDX-10 (2.25h) War Room API + UI
- Ranked opportunities page with sorting/filtering.
- Display workflow, annual cost, feasibility, ROI, confidence, review status.
- Done when seeded demo shows top opportunities correctly.

#### CDX-11 (2.0h) Tests + Smoke Flow
- Contract tests, formula tests, API smoke tests.
- End-to-end: ingest -> normalize -> workflow -> score -> dashboard.
- Done when smoke suite passes on local stack.

#### CDX-12 (2.25h) Local + Cloud Preview Deploy + Hardening
- Docker compose for api/web/workers/postgres/redis.
- Add quick cloud preview config for Vercel (web) and Railway (api/workers/postgres/redis).
- Seed script + demo runbook.
- Release notes + known limitations doc.
- Done when local one-command demo works and cloud preview URLs are reachable.

**Estimated Codex effort: 19.0h**

### Claude Tickets (Support, ~10%)

#### CLD-01 (1.0h) Evaluation Fixtures Pack
- Create labeled fixtures for workflow extraction + feasibility scoring.
- Output files under `/Users/rishi/Documents/NexusOS/evals/`.
- Include expected score ranges and confidence bands.
- Done when fixtures are machine-readable JSON/JSONL and documented.

#### CLD-02 (1.1h) Adversarial + Calibration Pack
- Create prompt-injection/adversarial content dataset for ingestion/scoring tests.
- Add concise threshold calibration notes under `/Users/rishi/Documents/NexusOS/docs/decision/`.
- Done when Codex can directly consume artifacts in tests.

**Estimated Claude effort: 2.1h**

### Split Summary
- Codex: 19.0h (~90.1%)
- Claude: 2.1h (~9.9%)

## 6) Ticket Prompts (Copy/Paste)

### CDX-00 Prompt
```text
Implement CDX-00 in /Users/rishi/Documents/NexusOS.

Create a runnable monorepo skeleton with:
- apps/api
- apps/web
- apps/workers
- packages/contracts
- packages/shared

Include:
- NestJS API app in `apps/api`
- BullMQ-ready worker app in `apps/workers`
- Prisma setup for PostgreSQL in shared backend layer
- build/test/lint scripts
- environment templates
- basic API health endpoint

Constraints:
- Keep it minimal and stable.
- Do not add features beyond Day-1 scope.

Return:
1) Summary
2) Changed files (absolute paths)
3) Commands run
4) Test/build output
5) Risks/blockers
```

### CDX-01 Prompt
```text
Implement CDX-01 in /Users/rishi/Documents/NexusOS.

Goal:
Add auth and tenant-scoped middleware.

Requirements:
- Reject missing/invalid auth
- Add tenant_id and actor_id to request context
- Block cross-tenant access on all endpoints
- Add tests for auth failure and tenant isolation

Return:
1) Summary
2) Changed files
3) Commands run
4) Test results
5) Risks/blockers
```

### CDX-02 Prompt
```text
Implement CDX-02 in /Users/rishi/Documents/NexusOS.

Goal:
Create DB migrations for Day-1 schema:
- tenants
- connector_accounts
- sync_jobs
- raw_events
- normalized_events
- workflows
- workflow_nodes
- workflow_edges
- hlc_estimates
- feasibility_scores
- roi_simulations
- review_queue
- audit_events

Requirements:
- key indexes
- foreign keys
- dedupe-safe constraints
- migration up/down
- use Prisma migrations against PostgreSQL
```

### CDX-03 Prompt
```text
Implement CDX-03 in /Users/rishi/Documents/NexusOS.

Goal:
Slack read-only connector.

Requirements:
- paginated sync
- retry/backoff
- checkpointing
- idempotent raw event insert
- sync job status updates
- audit events on start/end/error
```

### CDX-04 Prompt
```text
Implement CDX-04 in /Users/rishi/Documents/NexusOS.

Goal:
Gmail read-only connector.

Requirements:
- incremental sync
- retry-safe resume
- dedupe by stable hash
- checkpoint persistence
- sync job metrics
```

### CDX-05 Prompt
```text
Implement CDX-05 in /Users/rishi/Documents/NexusOS.

Goal:
Normalization pipeline from raw events to canonical normalized events.

Requirements:
- provider mappers for Slack/Gmail
- canonical fields: actor_id, action_type, object_type, text, occurred_at, pii_tags
- malformed payload handling without worker crash
- capture failure reasons
```

### CDX-06 Prompt
```text
Implement CDX-06 in /Users/rishi/Documents/NexusOS.

Goal:
Deterministic workflow DAG reconstruction.

Requirements:
- recurring workflow clustering
- nodes/edges with transition stats
- actor/tool mapping
- deterministic confidence score
- tests using fixture dataset
```

### CDX-07 Prompt
```text
Implement CDX-07 in /Users/rishi/Documents/NexusOS.

Goal:
Feasibility scoring v1.

Requirements:
- deterministic sub-scores: determinism, risk, integration_readiness, exception_rate
- weighted final score
- optional LLM rationale in strict JSON schema
- fail closed if rationale invalid
- persist score + confidence
```

### CDX-08 Prompt
```text
Implement CDX-08 in /Users/rishi/Documents/NexusOS.

Goal:
Deterministic HLC + ROI calculations.

Formulas:
- Annual_HLC = frequency_per_year * (avg_minutes/60) * loaded_hourly_rate * confidence_factor
- Net_Annual_Savings = HLC_saved - (token_cost + infra_cost + supervision_cost + maintenance_cost)
- Payback_Months = implementation_cost / (Net_Annual_Savings/12)

Requirements:
- deterministic outputs
- rounding policy documented
- unit tests
```

### CDX-09 Prompt
```text
Implement CDX-09 in /Users/rishi/Documents/NexusOS.

Goal:
Review queue and confidence gating.

Requirements:
- confidence < 0.70 => NEEDS_REVIEW
- approve/reject endpoint with reason
- audit events for review actions
- ensure low-confidence items are not marked RECOMMENDED
```

### CDX-10 Prompt
```text
Implement CDX-10 in /Users/rishi/Documents/NexusOS.

Goal:
War Room page and supporting API.

Requirements:
- ranked opportunities by annual savings/payback/risk
- sortable and filterable UI
- fields: workflow, HLC, feasibility, ROI, confidence, review status
- PII-masked output
```

### CDX-11 Prompt
```text
Implement CDX-11 in /Users/rishi/Documents/NexusOS.

Goal:
Testing and smoke validation.

Requirements:
- API contract tests
- formula unit tests
- e2e smoke flow from ingest to dashboard
- local run instructions
```

### CDX-12 Prompt
```text
Implement CDX-12 in /Users/rishi/Documents/NexusOS.

Goal:
Local deployment and hardening.

Requirements:
- docker compose for api/web/workers/postgres/redis
- cloud preview setup: Vercel for `apps/web`, Railway for api/workers/postgres/redis
- seed demo script
- release notes and known limitations
- one-command startup from clean checkout
```

### CLD-01 Prompt
```text
Implement CLD-01 in /Users/rishi/Documents/NexusOS.

Goal:
Create evaluation fixtures for workflow extraction and feasibility scoring.

Constraints:
- Edit only:
  - /Users/rishi/Documents/NexusOS/evals/*
  - /Users/rishi/Documents/NexusOS/docs/qa/*
- Do not modify runtime code.

Deliverables:
- Machine-readable fixtures (JSON/JSONL)
- Expected outcome labels and confidence bands
- Brief usage notes for test harness
```

### CLD-02 Prompt
```text
Implement CLD-02 in /Users/rishi/Documents/NexusOS.

Goal:
Create adversarial dataset + calibration notes.

Constraints:
- Edit only:
  - /Users/rishi/Documents/NexusOS/evals/*
  - /Users/rishi/Documents/NexusOS/docs/decision/*
- Do not modify runtime code.

Deliverables:
- Prompt-injection/adversarial test corpus
- Scoring threshold calibration notes (concise)
- Clear handoff notes so Codex can integrate quickly
```

## 7) Handoff Prompt (Both Tools)
```text
Handoff for <ticket-id>.

Provide exactly:
1) Status: done/in-progress/blocked
2) Changed files (absolute paths)
3) Commands run
4) Tests/validations run
5) Remaining work
6) Assumptions/risks
```

## 8) Final Integration Prompt (Codex)
```text
Run final Day-1 integration in /Users/rishi/Documents/NexusOS.

Tasks:
1) Integrate all completed tickets.
2) Resolve conflicts without changing business intent.
3) Run full tests + smoke.
4) Verify pipeline: sync -> normalize -> workflow -> score -> war room.
5) Verify confidence gating and audit trace.
6) Produce go/no-go report with known issues and demo steps.
```
