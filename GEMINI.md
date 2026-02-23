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

## Roadmap Status: Phases 1–3 Completed

### Phase 1: Foundation Hardening (Complete)
- [x] **Real Auth:** JWT-based authentication (RS256) with Login, Register, and Refresh flows.
- [x] **Multi-Tenancy:** Row-level security in the database, tenant-scoped queries, and tenant provisioning.
- [x] **Real OAuth (Core):** Full OAuth 2.0 implementation for Slack and Gmail with encrypted token storage.
- [x] **Database Hardening:** `users` and `tenants` tables, migrations, and connection pooling.

### Phase 2: UI/UX Overhaul (Complete)
- [x] **Design System:** Integrated Tailwind CSS 4.0 and shadcn/ui components.
- [x] **App Shell:** Persistent sidebar navigation, tenant switcher, and responsive layout.
- [x] **War Room:** Redesigned interface for workflow visualization and scoring breakdown.
- [x] **Review Queue:** Dedicated page for human-in-the-loop validation of low-confidence recommendations.
- [x] **Connectors & Settings:** Full management UI for OAuth connections and tenant settings.

### Phase 3: More Connectors (Complete)
- [x] **Connector Framework:** Abstracted logic for easy integration of new data sources.
- [x] **Expanded Integrations:** Fully implemented OAuth and sync logic for:
    - **GitHub:** Repos, PRs, and Issues.
    - **Notion:** Pages and Databases.
    - **Linear:** Issues and Projects.
    - **Jira:** Issues and Transitions (including Cloud ID resolution).

## Current Focus: Phase 4 — Agent Runtime & Execution
The project is now moving towards executing the workflows it discovers.
- **Automation Blueprints:** Defining the schema for executable workflows.
- **Agent Executor:** Developing the service that dispatches write-back actions to connectors.
- **Safety & Controls:** Implementing dry-run modes, rate limits, and audit logs for all automated actions.

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
