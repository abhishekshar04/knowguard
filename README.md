# KnowGuard

Permission-aware enterprise knowledge platform. The core invariant:

> No document chunk may enter an AI retrieval context unless the requesting user is authorized to read its parent document.

Authorization happens **before** retrieval and context construction — never by asking an LLM to withhold information.

**Status: Phase 1 (foundation).** Monorepo, API, worker, web, database schema for tenancy and RBAC, seed data, health checks. There is no authentication, documents or AI yet.

## Layout

```text
apps/
  api/        NestJS HTTP API (modular monolith)          → http://localhost:4000/api/v1
  worker/     BullMQ background worker (ingestion later)
  web/        Next.js App Router + Tailwind + shadcn/ui   → http://localhost:3000
packages/
  database/   Prisma schema, migrations, seed, client, tenant provisioning
  authorization/  Permission catalog + system roles (policy engine lands in Phase 4)
  auth/       Password hashing (argon2id); sessions/OAuth later
  validation/ zod env schemas + input primitives
  logger/     pino with secret redaction
  types/      Shared API contract types (browser-safe)
  storage/    Object storage interface (Phase 5)
  ai/         AI provider interfaces (Phase 6/8)
docs/adr/     Architecture decision records
docker/       Postgres init scripts
```

## Prerequisites

- Node.js ≥ 22, pnpm 10 (`corepack enable`)
- Docker Desktop (running)

## Getting started

```bash
cp .env.example .env          # local-only placeholder values
pnpm install
pnpm infra:up                 # PostgreSQL (pgvector) + Redis, waits until healthy
pnpm build                    # builds shared packages + generates Prisma client
pnpm db:deploy                # apply migrations (use db:migrate when changing the schema)
pnpm db:seed                  # Acme org, owner/admin/employee, roles, permissions
pnpm dev                      # api + worker + web in watch mode
```

Then open http://localhost:3000 (dashboard) or `curl http://localhost:4000/api/v1/health`.

Seeded users (password = `SEED_USER_PASSWORD` from `.env`): `owner@acme.example`, `admin@acme.example`, `employee@acme.example`.

## Commands

| Command                                              | What it does                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev`                                           | Run api, worker and web in watch mode                                |
| `pnpm build`                                         | Build everything (dependency-ordered by Turborepo)                   |
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | Static checks                                                        |
| `pnpm test`                                          | Unit tests (no infrastructure needed)                                |
| `pnpm --filter @knowguard/database db:test:prepare`  | Apply migrations to the test database                                |
| `pnpm test:e2e`                                      | Integration + e2e tests against Postgres/Redis (`TEST_DATABASE_URL`) |
| `pnpm db:migrate --name <name>`                      | Create and apply a new migration (dev)                               |
| `pnpm db:deploy`                                     | Apply pending migrations (CI/prod)                                   |
| `pnpm db:seed`                                       | Idempotent development seed                                          |
| `pnpm infra:up` / `pnpm infra:down`                  | Start/stop Docker infrastructure                                     |

## Environment variables

All configuration lives in the repo-root `.env` (template: [.env.example](.env.example)). Apps validate their environment at startup with zod and refuse to boot on invalid config; error messages name the variable but never echo its value.

| Variable                                                             | Used by                | Purpose                                           |
| -------------------------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| `NODE_ENV`                                                           | all                    | `development` \| `test` \| `production`           |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | docker compose         | Postgres container                                |
| `DATABASE_URL`                                                       | api, database          | Postgres connection string                        |
| `TEST_DATABASE_URL`                                                  | tests                  | Separate test database (name must contain `test`) |
| `REDIS_PORT`, `REDIS_PASSWORD`                                       | docker compose         | Redis container (password required)               |
| `REDIS_URL`                                                          | api, worker            | Redis connection string                           |
| `API_PORT`                                                           | api                    | HTTP port (default 4000)                          |
| `WEB_ORIGIN`                                                         | api                    | Comma-separated CORS allowlist                    |
| `LOG_LEVEL`                                                          | api, worker            | pino level                                        |
| `WORKER_CONCURRENCY`                                                 | worker                 | Parallel jobs (default 4)                         |
| `API_URL`                                                            | web (server-side only) | Base URL of the API                               |
| `SEED_USER_PASSWORD`                                                 | seed                   | Password for seeded demo users (≥ 12 chars)       |

## Architecture decisions

See [docs/adr](docs/adr):

1. [Modular monolith, worker and internal packages](docs/adr/0001-modular-monolith-and-packages.md)
2. [Pinned framework versions](docs/adr/0002-framework-versions.md)
3. [Tenant isolation enforced in the schema](docs/adr/0003-tenant-isolation-in-schema.md)
4. [Credentials and API error handling](docs/adr/0004-credentials-and-errors.md)
