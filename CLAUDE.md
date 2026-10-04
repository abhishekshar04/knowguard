# KnowGuard — guide for AI assistants

Permission-aware enterprise knowledge platform. **Core invariant:** no document chunk may be
retrieved, shown or sent to an AI model unless the requesting user may READ its parent document.
Authorization always happens _before_ retrieval — never by asking a model to withhold content.

## Orientation: use the knowledge graph first

`graphify-out/` holds a code knowledge graph (tree-sitter, built locally, no LLM):

- `graphify-out/GRAPH_REPORT.md` — core abstractions ("God Nodes"), communities, surprising links.
- `graphify query "<question>"` — scoped subgraph for a question (offline, fast).
- `graphify explain "<Symbol>"`, `graphify path "<A>" "<B>"` — a node's neighbours / how two connect.
- `graphify-out/GRAPH_TREE.html`, `graph.html` — visual views for humans.

The report records the commit it was built from ("Graph Freshness"); compare with
`git rev-parse HEAD`. Refresh after code changes (local, no API cost):

```bash
graphify update . && graphify cluster-only . --no-label && graphify tree
```

Always pass `--no-label` / `--code-only`: other modes send code to an LLM API. Read files directly
whenever you need exact lines — the graph is for orientation, not a substitute for the source.

## Layout

| Path                                                        | What                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/api`                                                  | NestJS API (modular monolith): auth, members, roles, structure, documents, search, ai, audit |
| `apps/worker`                                               | BullMQ ingestion worker: extract → chunk → embed → store                                     |
| `apps/web`                                                  | Next.js BFF + UI (server actions; the browser never calls the API directly)                  |
| `packages/authorization`                                    | Pure authorization engine `authorize()` + permission catalog                                 |
| `packages/database`                                         | Prisma schema, migrations, seed, `readableDocumentsWhere` (SQL twin of the engine)           |
| `packages/ai`                                               | Local embeddings + reranker, `ChatProvider` + OpenAI adapter (all model code here)           |
| `packages/storage`, `validation`, `types`, `auth`, `logger` | Object storage, zod schemas, contracts, credentials, logging                                 |
| `docs/adr/`                                                 | Architecture decisions 0001–0013 — read the relevant ADR before changing a subsystem         |

## Security rules that must hold

- Tenant (`organizationId`) and user always come from the session (`AuthContext`), never from input.
- Every route is authenticated by default (global guard); opt out only with `@Public()`.
- `@RequirePermission()` is a capability gate; resource access goes through `authorize()`.
- Documents the caller cannot READ return **404, identical to missing** — never 403, never titles.
- `readableDocumentsWhere` must stay exactly equivalent to `authorize(ctx, 'READ', doc)`; the
  randomized test in `packages/database/test/document-access.int-spec.ts` guards this.
- Escalation rules are permission-based (never role names): no self-management, no managing or
  granting beyond your own permissions, an active owner must remain.
- Ask AI builds its context only from `SearchService.retrieve()` (the permission-filtered
  pipeline); never add a second retrieval path. Tests pin `AI_PROVIDER=fake` (ADR 0011).
- Audit security-relevant actions with `AuditService` (ADR 0012); never put content, queries,
  questions or secrets in metadata. `audit_logs` is append-only (DB trigger); delete only via
  `purgeAuditLogs()`.
- Tenant-owned tables use composite `(id, organization_id)` foreign keys.
- Never commit `.env` or secrets; env vars are validated with zod and must also be listed in
  `turbo.json` `globalPassThroughEnv` or tasks won't see them in CI.

## Frontend security rules (apps/web)

Enforced by lint, CSP and tests (ADR 0013). Follow them rather than working around them:

- Render user and document text as React text. No `dangerouslySetInnerHTML`, `innerHTML`, `eval`
  or `javascript:` URLs; rich content needs a reviewed sanitizer first.
- Only server code (server components, server actions, route handlers) calls the API or reads
  the session (`lib/api`, `lib/session`). Client components receive data as props or via
  server actions; new client-side `fetch` targets same-origin route handlers only.
- New route handlers that change state must check `Origin` like `app/(app)/ask/stream/route.ts`
  (server actions get this check from Next.js; route handlers do not).
- No `localStorage`/`sessionStorage`/`document.cookie`, and no `NEXT_PUBLIC_` env vars.
- The CSP (`proxy.ts`) allows no third-party origins and no inline scripts. Adding a font, script,
  image host or API origin is a deliberate change there — never `'unsafe-inline'` for scripts.
- Browser tests import `test`/`expect` from `e2e/fixtures.ts`: it fails tests on uncaught page
  errors and CSP violations. Hidden and missing resources look identical (404) in the UI too.

## API security rules for new endpoints

- `test/security.e2e-spec.ts` sweeps every route automatically: unauthenticated → 401, missing
  capability → 403, another organization's IDs → 404. A new public or capability-less route, or a
  new route with path parameters, fails it until you add it to the reviewed lists/cases there.

## Commands

```bash
pnpm infra:up            # Postgres (pgvector), Redis, SeaweedFS
pnpm build && pnpm dev   # api :4000, web :3000, worker
pnpm lint && pnpm typecheck && pnpm format:check
pnpm test                # unit
pnpm db:test:prepare && pnpm test:e2e   # integration (real DB/Redis/storage/models)
pnpm test:browser        # Playwright (run pnpm build first)
pnpm db:check-drift      # schema.prisma vs database (also in CI)
pnpm security:secrets    # credential scan of committed files (also in CI)
pnpm security:audit      # high/critical advisories in production deps (also in CI)
pnpm --filter @knowguard/web check:bundle   # no server config in the browser bundle (after build)
```

Migrations are hand-authored via `prisma migrate diff` (see ADR 0005/0010); `migrate dev` is
interactive and Prisma refuses `migrate reset` from AI agents. Search indexes live in raw SQL.

## Gotchas

- Windows: a running `pnpm dev` or stray Jest process locks Prisma's engine DLL (`EPERM` on
  `prisma generate`); check for leftover node processes before rebuilding.
- Jest needs `tooling/jest/onnx-environment.js` for ONNX models and `--experimental-vm-modules`
  for pdf.js (worker).
- BullMQ never closes connections it is given; close them yourself in tests.
- Tests and dev share Redis — keep distinct `QUEUE_PREFIX` values.
