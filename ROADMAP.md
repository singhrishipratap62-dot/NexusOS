# NexusOS — Full Product Roadmap
> Goal: Production-grade SaaS. Real OAuth, live data, polished UI, agent runtime, multi-tenant, billing-ready.
> Deadline: < 1 week from MVP.
> Today: 2026-02-23

---

## Current State (MVP Done ✓)

- Single-tenant, fixture-backed Audit MVP
- Deterministic scoring: feasibility, HLC, ROI
- Workflow DAG extraction
- War Room table (basic CSS, no design system)
- Human review gating (API only, no UI action buttons)
- Docker Compose local dev
- Static Bearer token auth

---

## Phase 1 — Foundation Hardening (Day 1–2)
> Get the core trustworthy before adding features.

### 1A — Real Auth (replace static Bearer token)
- [ ] Implement JWT auth with RS256 (access + refresh token pair)
- [ ] Add `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` endpoints
- [ ] Persist users table (email, hashed password, role: ADMIN | ANALYST | VIEWER)
- [ ] Replace `AUTH_STATIC_TOKEN` env var guard with JWT middleware
- [ ] Add RBAC guards: Analyst can review, Viewer read-only, Admin all
- [ ] Session handling on web (cookie-based JWT storage, httpOnly)

### 1B — Multi-Tenant Architecture
- [ ] Tenant provisioning endpoint (admin only): `POST /tenants`
- [ ] Row-level security: all DB queries scoped by `tenantId` from JWT claims (not header)
- [ ] Tenant-scoped connector credentials (per-tenant OAuth apps or shared app)
- [ ] Tenant invite/onboarding flow (web)
- [ ] Migrate `x-tenant-id` header → JWT claim (remove header-based trust)

### 1C — Real OAuth — Slack
- [ ] Implement full Slack OAuth 2.0 app install flow (not just token exchange placeholder)
- [ ] Store encrypted OAuth tokens per tenant (use AES-256-GCM, key from env)
- [ ] Token refresh logic (Slack uses long-lived tokens, but handle revocation)
- [ ] Webhook receiver for real-time Slack events (Slack Events API)
- [ ] Live channel sync with real workspace data (replace fixture fallback)
- [ ] OAuth connection status UI (connected/disconnected/error badge)

### 1D — Real OAuth — Gmail
- [ ] Full Google OAuth 2.0 flow with consent screen
- [ ] Store + encrypt refresh tokens per tenant
- [ ] Token auto-refresh (Google access tokens expire in 1h)
- [ ] Gmail push notifications via Pub/Sub (replace polling with webhooks)
- [ ] Live email sync replacing fixture fallback
- [ ] OAuth connection status UI

### 1E — Database hardening
- [ ] Add `users` table + migrations
- [ ] Add `tenant_members` (user↔tenant many-to-many with role)
- [ ] Encrypt sensitive columns at rest (OAuth tokens, emails if stored)
- [ ] Add DB connection pooling (PgBouncer or Prisma connection limit config)
- [ ] Add soft deletes for audit trail preservation

---

## Phase 2 — UI/UX Overhaul (Day 2–3)
> Replace raw table with a proper product interface.

### 2A — Design System
- [ ] Pick and install component library: **shadcn/ui** (Tailwind-based, copy-paste, no lock-in)
- [ ] Set up Tailwind CSS properly in `apps/web`
- [ ] Define design tokens: colors, typography, spacing
- [ ] Build reusable components: Button, Badge, Card, Table, Modal, Toast, Sidebar, Nav

### 2B — App Shell
- [ ] Persistent sidebar navigation (War Room, Review Queue, Connectors, Settings)
- [ ] Top nav with tenant switcher + user avatar + logout
- [ ] Responsive layout (mobile-first)
- [ ] Loading skeletons for async data
- [ ] Error boundary + fallback UI

### 2C — War Room Page (redesign)
- [ ] Cards view + table toggle
- [ ] Workflow detail modal/drawer (full DAG visualization, score breakdown, actor list)
- [ ] In-line approve/reject actions for review queue items (no separate page needed)
- [ ] Score breakdown tooltips (explain feasibility sub-scores)
- [ ] Export to CSV button
- [ ] Real-time updates via polling or SSE

### 2D — Review Queue Page
- [ ] Dedicated `/review` page with PENDING items only
- [ ] Side-by-side: workflow DAG preview + scoring breakdown + analyst decision form
- [ ] Bulk approve/reject with reason
- [ ] Decision history log per workflow
- [ ] Email notification on new items entering review queue

### 2E — Connectors Page
- [ ] `/connectors` — list installed connectors with sync status, last sync time, event count
- [ ] One-click OAuth connect/disconnect
- [ ] Manual sync trigger with progress indicator
- [ ] Sync history log (last 10 jobs with status, duration, event count)
- [ ] Error display for failed syncs with retry button

### 2F — Settings Page
- [ ] Team management (invite by email, assign roles, remove members)
- [ ] Tenant profile (name, logo upload)
- [ ] Notification preferences (email for review queue, weekly summary)
- [ ] API key management (generate/revoke keys for programmatic access)
- [ ] Audit log viewer (paginated, filterable by action type)

### 2G — Auth Pages
- [ ] `/login` — email + password with JWT
- [ ] `/register` — for invite-based signup
- [ ] `/forgot-password` and `/reset-password`
- [ ] Protected route middleware (Next.js middleware)

---

## Phase 3 — More Connectors (Day 3–4)
> Expand data sources for richer workflow detection.

### 3A — Connector Framework Abstraction
- [ ] Generic `ConnectorBase` interface: `connect()`, `sync()`, `disconnect()`, `getStatus()`
- [ ] Connector registry in DB (name, type, config schema, status)
- [ ] Dynamic connector config form (driven by JSON schema per connector type)
- [ ] Unified sync job monitoring across all connectors

### 3B — Notion Connector
- [ ] OAuth via Notion API
- [ ] Sync pages, databases, and page edits as events
- [ ] Map to normalized events: actor, action=page_edit/database_query, occurred_at

### 3C — Linear Connector
- [ ] OAuth via Linear API
- [ ] Sync issues, comments, status changes, assignments
- [ ] Map to normalized events: actor, action=issue_created/updated/resolved

### 3D — GitHub Connector
- [ ] OAuth via GitHub App or OAuth App
- [ ] Sync PRs, commits, reviews, issues, comments
- [ ] Map to normalized events: actor, tool=GitHub, action=pr_opened/merged/reviewed

### 3E — Jira Connector
- [ ] OAuth via Atlassian Cloud
- [ ] Sync issues, transitions, comments
- [ ] Map to normalized events: actor, action=issue_moved/commented

### 3F — Calendar Connector (Google Calendar / Outlook)
- [ ] Meeting data as events: attendees, duration, recurrence
- [ ] Use for time-cost calculations in HLC (meeting overhead)

---

## Phase 4 — Agent Runtime + Execution (Day 4–5)
> Move from audit-only to executing automations.

### 4A — Automation Blueprint Schema
- [ ] Define `AutomationBlueprint` schema (extends `Workflow`):
  - `steps[]`: ordered actions with tool, action, parameters, conditions
  - `triggerType`: SCHEDULED | EVENT | MANUAL
  - `triggerConfig`: cron expression or event filter
  - `rollbackPolicy`: ON_ERROR | NEVER
- [ ] Blueprint builder UI (visual step editor, starts simple with JSON)
- [ ] Blueprint version history
- [ ] Dry-run simulation mode (preview what would happen)

### 4B — Agent Executor
- [ ] `AutomationRun` model in DB (blueprintId, status, stepResults[], logs, triggeredBy)
- [ ] Step executor service: dispatches actions to connector SDKs
- [ ] Supported write-back actions:
  - Slack: send message, create channel, archive channel
  - Gmail: send draft, label email, move to folder
  - Linear: create issue, update status
  - Notion: create page, update property
  - GitHub: create issue, post comment
- [ ] Execution sandboxing: each run isolated, no cross-tenant bleed
- [ ] Timeout per step (configurable, default 30s)
- [ ] Retry policy per step

### 4C — Trigger System
- [ ] Cron scheduler (BullMQ repeatable jobs) for SCHEDULED triggers
- [ ] Event-based triggers: webhook receiver routes event → matches blueprint trigger conditions → enqueues run
- [ ] Manual trigger: "Run now" button on blueprint page

### 4D — Execution Monitoring
- [ ] `/runs` page: list all automation runs with status (QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED)
- [ ] Live run log streaming (SSE from API)
- [ ] Run detail page: step-by-step execution trace, input/output per step
- [ ] Alert on failure (email + in-app notification)
- [ ] Human-in-the-loop pause: HITL step type that waits for analyst approval before continuing

### 4E — Safety Controls
- [ ] Dry-run mode enforcement (blueprints start in dry-run, require explicit enable)
- [ ] Write-back rate limiting per connector per tenant
- [ ] Emergency kill switch: `POST /runs/:id/cancel`
- [ ] Audit log for every write-back action (actor=system, action=automation_write_back)
- [ ] Blast radius limits (max messages/emails per run configurable)

---

## Phase 5 — Production Hardening (Day 5–6)
> Make it safe for real customers.

### 5A — Security
- [ ] API rate limiting (per tenant, per endpoint) via Redis token bucket
- [ ] Input sanitization + XSS protection (DOMPurify on web, strip-tags on API)
- [ ] SQL injection prevention (already using Prisma, verify no raw queries)
- [ ] CORS configuration (whitelist tenant origins)
- [ ] Security headers (helmet.js in NestJS, already partial)
- [ ] Secrets rotation: OAuth tokens re-encrypted on key rotation
- [ ] Dependency audit (`pnpm audit`, fix HIGH+ vulnerabilities)

### 5B — Observability
- [ ] Structured logging with trace IDs (winston or pino with correlation ID middleware)
- [ ] Error tracking (Sentry integration for API + web)
- [ ] Metrics (Prometheus-compatible endpoint or use Railway metrics)
- [ ] Alerts: connector sync failures, review queue backlog > N, automation failures
- [ ] Health check expansion: DB, Redis, connector status in `/health`

### 5C — Performance
- [ ] API response caching (Redis, 30s TTL for war-room opportunities)
- [ ] Pagination on all list endpoints (cursor-based for large datasets)
- [ ] Database query optimization (add missing indexes, N+1 audit)
- [ ] Worker auto-scaling config (Railway horizontal scaling)

### 5D — Deployment
- [ ] CI/CD pipeline (GitHub Actions): lint → test → build → deploy on merge to main
- [ ] Environment separation: staging (Railway) + production (Railway)
- [ ] DB migration automation on deploy (Prisma migrate deploy)
- [ ] Zero-downtime deploy strategy
- [ ] Environment variable management (Railway secrets, not in repo)
- [ ] Custom domain + TLS for web (Vercel handles this)

### 5E — Billing (Stripe)
- [ ] Stripe integration: `stripe` npm package
- [ ] Plans: Free (1 connector, 30d history, no execution), Pro ($49/mo, 5 connectors, execution), Enterprise (custom)
- [ ] `/billing` page with plan overview, usage, upgrade CTA
- [ ] Stripe Checkout for plan upgrades
- [ ] Stripe webhooks for subscription lifecycle (created, updated, cancelled)
- [ ] Usage metering: track connector syncs, automation runs per tenant per billing period
- [ ] Feature flags driven by subscription tier

---

## Phase 6 — Polish + Launch (Day 6–7)
> Get to a shippable state.

### 6A — Onboarding Flow
- [ ] Post-signup onboarding wizard (connect first connector → run audit → see War Room)
- [ ] Empty state UI for no-data scenarios (clear CTAs)
- [ ] Sample data / demo mode toggle (show fixture data for new users)
- [ ] In-app help tooltips on key concepts (feasibility score, HLC, etc.)

### 6B — Email Notifications
- [ ] Transactional email setup (Resend or Postmark)
- [ ] Emails: welcome, invite, review queue alert, weekly audit summary, automation failure
- [ ] Unsubscribe / notification preferences respected

### 6C — Landing Page
- [ ] Replace current Next.js root with a proper landing page (or separate static site)
- [ ] Hero: "AI audits your team's workflows. Finds automation opportunities. Ships them."
- [ ] Feature highlights + pricing table
- [ ] CTA: "Start free audit" → signup

### 6D — Documentation
- [ ] API reference (auto-generate from NestJS Swagger decorators)
- [ ] Connector setup guides (Slack, Gmail, etc.)
- [ ] User guide (War Room, Review Queue, Blueprints)

---

## Ticket Summary by Phase

| Phase | Focus | Key Deliverables | Effort Est. |
|-------|-------|-----------------|-------------|
| 1 | Foundation | JWT auth, multi-tenant, real OAuth, encrypted tokens | 1.5 days |
| 2 | UI/UX | Design system, app shell, all pages, auth flows | 1.5 days |
| 3 | Connectors | 4+ new connectors (Notion, Linear, GitHub, Jira) | 1 day |
| 4 | Agent Runtime | Blueprint schema, executor, triggers, HITL, safety | 1.5 days |
| 5 | Production | Security, observability, perf, CI/CD, billing | 1 day |
| 6 | Launch | Onboarding, email, landing page, docs | 0.5 days |

**Total: ~7 days parallel execution**

---

## Immediate Next Steps (Start Now)

Priority order based on dependency graph:

1. **Phase 1A** (JWT auth) — blocks everything else (UI, multi-tenant, billing)
2. **Phase 2A** (shadcn/ui + Tailwind setup) — blocks all UI work
3. **Phase 1C + 1D** (Real OAuth) — can run parallel to UI
4. **Phase 2B–2G** (App shell + all pages) — after design system
5. **Phase 3A** (Connector framework) — before adding more connectors
6. **Phase 4A–4E** (Agent runtime) — after connectors, requires auth + multi-tenant done
7. **Phase 5** (Hardening) — continuous, not one-shot
8. **Phase 6** (Polish + launch) — final gate

---

## Tech Additions Required

| Addition | Package | Reason |
|---------|---------|--------|
| JWT | `@nestjs/jwt`, `passport-jwt` | Replace static token |
| Encryption | `node:crypto` (built-in) | Encrypt OAuth tokens at rest |
| Tailwind | `tailwindcss`, `autoprefixer` | Design system base |
| shadcn/ui | Copy-paste components | Component library |
| Stripe | `stripe` | Billing |
| Sentry | `@sentry/nestjs`, `@sentry/nextjs` | Error tracking |
| Email | `resend` or `@sendgrid/mail` | Transactional email |
| Swagger | `@nestjs/swagger` | API docs |
| bcrypt | `bcryptjs` | Password hashing |
| zxcvbn | optional | Password strength |

---

## Constraints & Rules (Carry Forward from Day-1)

- All scoring remains deterministic (no unvalidated LLM output in critical path)
- All write-back actions require audit log entry
- Low-confidence items never auto-recommended without human review
- PII masking enforced at API boundary
- Fail-closed on schema validation errors
- Rate limits enforced before any write-back action executes
