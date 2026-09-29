# ADR 0001 — Modular monolith, separate worker, internal packages

**Status:** Accepted (Phase 1)

## Context

KnowGuard needs an HTTP API, long-running background work (text extraction, embeddings) and a web UI. The security invariant (authorization before retrieval) is easiest to guarantee when authorization, tenancy and retrieval code live in one codebase with one set of tests.

## Decision

- **One API process** (NestJS) organised as feature modules (`auth`, `organizations`, `documents`, `search`, ...). Modules are added in the phase that needs them — no empty placeholder modules.
- **One worker process** (BullMQ) so embedding generation never blocks API requests. It shares packages with the API but not the NestJS runtime.
- **No microservices.** Splitting would multiply the places where tenant and permission checks must be re-implemented.
- **Internal packages** (`packages/*`) are compiled with `tsc` to CommonJS in `dist/`, and consumed via `main`/`types`. Turborepo builds dependencies first (`dependsOn: ["^build"]`). Compiled output keeps the API, the worker and Jest free of TypeScript path-mapping tricks.
- **Prisma lives in `packages/database`**, not `apps/api/prisma`, because the API and the worker both need the same client, schema and migrations.
- `packages/storage` and `packages/ai` contain only interfaces for now; vendor SDKs must stay inside these packages when implemented.

## Consequences

- Changing a package requires a rebuild (`pnpm dev` runs `^build` first; watch mode for packages can be added if iteration speed suffers).
- The web app imports only browser-safe packages (`@knowguard/types`); it reaches data through the API, never through Prisma.
