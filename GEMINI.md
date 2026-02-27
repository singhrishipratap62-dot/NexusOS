# NexusOS — Project Context & Roadmap Status

## Project Overview
NexusOS is an AI-driven audit platform designed to discover, score, and automate organizational workflows. It ingests data from various communication and project management tools (Slack, Gmail, GitHub, Notion, etc.), extracts workflow patterns, and provides actionable insights through a "War Room" interface.

## System Architecture
- **Monorepo:** Managed with `pnpm`.
- **API (`apps/api`):** NestJS framework with Prisma ORM.
- **Web (`apps/web`):** Next.js (App Router) with Tailwind CSS and shadcn/ui.
- **Workers (`apps/workers`):** BullMQ for background job processing (e.g., connector syncs, scoring).
- **Contracts (`packages/contracts`):** Shared TypeScript types and JSON schemas.
- **Shared (`packages/shared`):** Utility functions, scoring logic, and connector implementations.
- **Database:** PostgreSQL (via Prisma).
- **Cache/Queue:** Redis (via BullMQ/ioredis).

## Roadmap Status: Phases 1–6 Completed

### Phase 1: Foundation Hardening (Complete)
- [x] **Real Auth:** JWT-based authentication (HS256) with Login, Register, Refresh, Logout, and Me endpoints.
- [x] **Multi-Tenancy:** Row-level security in the database, tenant-scoped queries via JWT claims.
- [x] **Real OAuth (Core):** Full OAuth 2.0 implementation for Slack, Gmail, GitHub, Notion, Linear, and Jira with encrypted token storage.
- [x] **Database Hardening:** `users`, `tenants`, `tenant_members`, `refresh_tokens` tables, migrations, and RBAC guards.
- [x] **Route Protection:** Next.js middleware for authenticated route protection with JWT cookies.

### Phase 2: UI/UX Overhaul (Complete)
- [x] **Design System:** Tailwind CSS 4.0 with CSS design tokens and custom utility classes.
- [x] **App Shell:** Persistent sidebar navigation, top bar with logout, and responsive layout.
- [x] **Auth Pages:** Login and Register pages with JWT cookie-based session management.
- [x] **War Room:** Redesigned interface with summary stats, scored table, and filtering.
- [x] **Review Queue:** Dedicated page with pending/history split and approve/reject actions.
- [x] **Connectors & Settings:** Full management UI for all 7 OAuth connectors.
- [x] **Loading & Error States:** Loading skeletons for all pages and global error boundary.

### Phase 3: More Connectors (Complete)
- [x] **Connector Framework:** Abstracted logic for easy integration of new data sources.
- [x] **Expanded Integrations:** Fully implemented OAuth, sync, and normalization for:
    - **Slack:** Channel messages and activity patterns.
    - **Gmail:** Emails and thread patterns.
    - **Google Calendar:** Meeting data, time-cost calculations, workflow hints.
    - **GitHub:** Repos, PRs, and Issues.
    - **Notion:** Pages and Databases.
    - **Linear:** Issues and Projects.
    - **Jira:** Issues and Transitions (including Cloud ID resolution).
- [x] **Connector Disconnect:** DELETE endpoint to remove connector and sync history.
- [x] **Sync History:** UI showing recent sync jobs with status badges.

### Phase 4: Agent Runtime & Execution (Complete)
- [x] **Automation Blueprints:** Full CRUD API with schema: steps[], triggerType, triggerConfig, rollbackPolicy.
- [x] **Step Executor:** Service dispatching write-back actions to connector SDKs (Slack, Gmail, Linear, Notion, GitHub, Jira).
- [x] **Run Orchestration:** Sequential step execution with status tracking, logging, and audit events.
- [x] **Dry-Run Mode:** Blueprints start in dry-run, simulate without executing write-backs.
- [x] **Safety Controls:** Blast radius limits (max 50 steps/run), step timeouts (30s), cancel endpoint.
- [x] **Runs UI:** Full `/runs` page with blueprint list, "Run Now" button, runs table, expandable step results and logs.
- [x] **Audit Logging:** Every run completion and cancellation logged to `audit_events`.

### Phase 5: Production Hardening (Complete)
- [x] **Security Headers:** X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy.
- [x] **CORS Configuration:** Configurable origins via `CORS_ORIGIN`, credentials support.
- [x] **Rate Limiting:** Token bucket middleware per tenant per endpoint (configurable via env vars).
- [x] **Input Sanitization:** Global interceptor stripping HTML/XSS from request bodies and query params.
- [x] **Structured Logging:** Request logger middleware with correlation IDs, method, path, status, duration.
- [x] **Health Check:** Expanded with DB connectivity, uptime, memory usage (RSS/heap), version.
- [x] **Pagination:** Shared utility with limit/offset and cursor-based support (max 100).

### Phase 6: Polish + Launch (Complete)
- [x] **Onboarding Wizard:** 4-step post-signup flow (welcome → connect → audit → explore War Room).
- [x] **Settings Page:** Tabbed UI with Team, API Keys, Notifications, and Security sections.
- [x] **Loading States:** All pages have loading skeletons via Next.js loading convention.

## Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `JWT_SECRET`: Secret for signing tokens.
- `ENCRYPTION_KEY`: AES-256-GCM key for encrypting OAuth tokens.
- OAuth Credentials: `SLACK_CLIENT_ID`, `GMAIL_CLIENT_ID`, `GITHUB_CLIENT_ID`, etc.

## Development Workflow
1.  **Start Infrastructure:** `docker compose up -d postgres redis`
2.  **Generate/Migrate DB:** `pnpm prisma:generate` && `pnpm prisma:migrate`
3.  **Run Dev Servers:**
    - API: `pnpm dev:api`
    - Web: `pnpm dev:web`
    - Workers: `pnpm dev:workers`
4.  **Testing:**
    - Smoke Suite: `pnpm test:smoke`
    - Unit/Integration: `pnpm test`
