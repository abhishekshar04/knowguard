# KnowGuard

Permission-aware enterprise knowledge platform. The core invariant:

> No document chunk may enter an AI retrieval context unless the requesting user is authorized to read its parent document.

Authorization happens **before** retrieval and context construction — never by asking an LLM to withhold information.

**Status: Phase 7 (search).** Permission-aware hybrid search. Only documents you are allowed to read are searched: the permission filter runs before retrieval, and every result is re-checked by the authorization engine. Keyword search (Postgres full-text, including exact IDs and error codes) and meaning-based search (pgvector) are merged and then reranked by a local cross-encoder; everything runs on your own servers. Results cite the document, version, section and page. It builds on Phases 1–6: tenant isolation, the authorization engine, documents, and local ingestion and embeddings. Next: Ask AI with citations (Phase 8).

## How authentication works

```text
Browser ──HttpOnly cookie──▶ Next.js BFF (server actions) ──Bearer token──▶ NestJS API ──▶ PostgreSQL / Redis
```

- The browser only talks to Next.js. The API has no CORS and ignores cookies.
- The session token lives in an HttpOnly, SameSite=Lax cookie (`__Host-kg_session` in production). The database stores only its SHA-256 hash.
- Every API route requires a session unless it is marked `@Public()`. Each request re-checks revocation, expiry, idle timeout, and suspension of both the account and the membership.
- Details, limits and the production deployment requirement are in [ADR 0005](docs/adr/0005-identity-membership-and-sessions.md).

## Layout

```text
apps/
  api/        NestJS HTTP API (modular monolith)          → http://localhost:4000/api/v1
  worker/     BullMQ background worker (ingestion later)
  web/        Next.js App Router + Tailwind + shadcn/ui   → http://localhost:3000
packages/
  database/   Prisma schema, migrations, seed, client, tenant provisioning
  authorization/  Permission catalog + system roles (policy engine lands in Phase 4)
  auth/       Password hashing (argon2id), session tokens; OAuth/SSO later
  validation/ zod env + request schemas (shared by API and BFF)
  logger/     pino with secret redaction
  types/      Shared API contract types (browser-safe)
  storage/    Object storage interface (Phase 5)
  ai/         AI provider interfaces (Phase 6/8)
docs/adr/     Architecture decision records
docker/       Postgres init scripts
.github/      CI workflow (lint, typecheck, unit, integration, e2e, browser tests)
```

## Prerequisites

- Node.js ≥ 22, pnpm 10 (`corepack enable`)
- Docker Desktop (running)

## Getting started

```bash
cp .env.example .env          # local-only placeholder values
pnpm install
pnpm infra:up                 # PostgreSQL (pgvector), Redis, SeaweedFS (S3); waits until healthy
pnpm build                    # builds shared packages + generates Prisma client
pnpm db:deploy                # apply migrations (use db:migrate when changing the schema)
pnpm db:seed                  # Acme org, owner/admin/employee, roles, permissions
pnpm dev                      # api + worker + web in watch mode
```

Then open http://localhost:3000. You can create a new organization at `/register`, or sign in as a seeded user: `owner@acme.example`, `admin@acme.example` or `employee@acme.example`, with the password `SEED_USER_PASSWORD` from `.env`.

## Commands

| Command                                              | What it does                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                                           | Run api, worker and web in watch mode                                   |
| `pnpm build`                                         | Build everything (dependency-ordered by Turborepo)                      |
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | Static checks                                                           |
| `pnpm test`                                          | Unit tests (no infrastructure needed)                                   |
| `pnpm db:test:prepare`                               | Apply migrations to the test database                                   |
| `pnpm test:e2e`                                      | Integration + e2e tests against Postgres/Redis (`TEST_DATABASE_URL`)    |
| `pnpm test:browser`                                  | Playwright browser tests (run `pnpm build` first; uses ports 3100/4100) |
| `pnpm db:migrate --name <name>`                      | Create and apply a new migration (dev)                                  |
| `pnpm db:deploy`                                     | Apply pending migrations (CI/prod)                                      |
| `pnpm db:seed`                                       | Idempotent development seed                                             |
| `pnpm db:check-drift`                                | Fail if the database differs from `schema.prisma` (also runs in CI)     |
| `pnpm infra:up` / `pnpm infra:down`                  | Start/stop Docker infrastructure                                        |

## Environment variables

All configuration lives in the repo-root `.env` (template: [.env.example](.env.example)). Apps validate their environment at startup with zod and refuse to boot on invalid config; error messages name the variable but never echo its value.

| Variable                                                                  | Used by                | Purpose                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                | all                    | `development` \| `test` \| `production`                                                                  |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`      | docker compose         | Postgres container                                                                                       |
| `DATABASE_URL`                                                            | api, database          | Postgres connection string                                                                               |
| `TEST_DATABASE_URL`                                                       | tests                  | Separate test database (name must contain `test`)                                                        |
| `REDIS_PORT`, `REDIS_PASSWORD`                                            | docker compose         | Redis container (password required)                                                                      |
| `REDIS_URL`                                                               | api, worker            | Redis connection string                                                                                  |
| `API_PORT`                                                                | api                    | HTTP port (default 4000)                                                                                 |
| `SESSION_TTL_HOURS`                                                       | api                    | Absolute session lifetime (default 168)                                                                  |
| `SESSION_IDLE_TIMEOUT_MINUTES`                                            | api                    | Idle session expiry (default 1440)                                                                       |
| `TRUST_PROXY`                                                             | api                    | Hops trusted to set X-Forwarded-For (see ADR 0005)                                                       |
| `LOG_LEVEL`                                                               | api, worker            | pino level                                                                                               |
| `API_URL`                                                                 | web (server-side only) | Base URL of the API                                                                                      |
| `SESSION_COOKIE_SECURE`                                                   | web                    | Force the Secure cookie flag on/off (default: production only)                                           |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`                    | api                    | S3-compatible object storage (omit the endpoint for AWS S3)                                              |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`                      | api, docker compose    | Storage credentials                                                                                      |
| `STORAGE_FORCE_PATH_STYLE`, `STORAGE_AUTO_CREATE_BUCKET`                  | api                    | Path-style URLs (SeaweedFS/MinIO); create the bucket on boot (dev only)                                  |
| `MAX_UPLOAD_MB`                                                           | api                    | Upload size limit (default 25)                                                                           |
| `EMBEDDING_MODEL`, `EMBEDDING_CACHE_DIR`, `EMBEDDING_ALLOW_REMOTE_MODELS` | worker                 | Local embedding model, its cache (default `~/.cache/knowguard/models`), and whether it may be downloaded |
| `RERANKER_MODEL`                                                          | api                    | Local cross-encoder for search reranking (default bge-reranker-base; `none` disables)                    |
| `WORKER_CONCURRENCY`                                                      | worker                 | Parallel ingestion jobs (default 2)                                                                      |
| `QUEUE_PREFIX`                                                            | api, worker            | BullMQ key prefix; environments sharing a Redis must differ                                              |
| `SEED_USER_PASSWORD`                                                      | seed                   | Password for seeded demo users (≥ 12 chars)                                                              |

## Architecture decisions

See [docs/adr](docs/adr):

1. [Modular monolith, worker and internal packages](docs/adr/0001-modular-monolith-and-packages.md)
2. [Pinned framework versions](docs/adr/0002-framework-versions.md)
3. [Tenant isolation enforced in the schema](docs/adr/0003-tenant-isolation-in-schema.md)
4. [Credentials and API error handling](docs/adr/0004-credentials-and-errors.md)
5. [Identity, membership, sessions and the BFF](docs/adr/0005-identity-membership-and-sessions.md)
6. [Minimal RBAC, invitations and organization structure](docs/adr/0006-rbac-invitations-and-organization-structure.md)
7. [Authorization engine and custom roles](docs/adr/0007-authorization-engine.md)
8. [Documents, storage and query-level access control](docs/adr/0008-documents-storage-and-access.md)
9. [Ingestion pipeline and local embeddings](docs/adr/0009-ingestion-and-embeddings.md)
10. [Permission-aware hybrid search](docs/adr/0010-permission-aware-hybrid-search.md)

## Deploying: required

The web app must sit behind a reverse proxy or load balancer that sets or appends `X-Forwarded-For`, and the API's `TRUST_PROXY` must name the BFF. Otherwise per-IP rate limits can be evaded by spoofing that header. See ADR 0005.
