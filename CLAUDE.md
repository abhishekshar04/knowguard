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

| Path                                                        | What                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/api`                                                  | NestJS API (modular monolith): auth, members, roles, structure, documents, search    |
| `apps/worker`                                               | BullMQ ingestion worker: extract → chunk → embed → store                             |
| `apps/web`                                                  | Next.js BFF + UI (server actions; the browser never calls the API directly)          |
| `packages/authorization`                                    | Pure authorization engine `authorize()` + permission catalog                         |
| `packages/database`                                         | Prisma schema, migrations, seed, `readableDocumentsWhere` (SQL twin of the engine)   |
| `packages/ai`                                               | Local embedding model + reranker (all model code lives here)                         |
| `packages/storage`, `validation`, `types`, `auth`, `logger` | Object storage, zod schemas, contracts, credentials, logging                         |
| `docs/adr/`                                                 | Architecture decisions 0001–0010 — read the relevant ADR before changing a subsystem |

## Security rules that must hold

- Tenant (`organizationId`) and user always come from the session (`AuthContext`), never from input.
- Every route is authenticated by default (global guard); opt out only with `@Public()`.
- `@RequirePermission()` is a capability gate; resource access goes through `authorize()`.
- Documents the caller cannot READ return **404, identical to missing** — never 403, never titles.
- `readableDocumentsWhere` must stay exactly equivalent to `authorize(ctx, 'READ', doc)`; the
  randomized test in `packages/database/test/document-access.int-spec.ts` guards this.
- Escalation rules are permission-based (never role names): no self-management, no managing or
  granting beyond your own permissions, an active owner must remain.
- Tenant-owned tables use composite `(id, organization_id)` foreign keys.
- Never commit `.env` or secrets; env vars are validated with zod and must also be listed in
  `turbo.json` `globalPassThroughEnv` or tasks won't see them in CI.

## Commands

```bash
pnpm infra:up            # Postgres (pgvector), Redis, SeaweedFS
pnpm build && pnpm dev   # api :4000, web :3000, worker
pnpm lint && pnpm typecheck && pnpm format:check
pnpm test                # unit
pnpm db:test:prepare && pnpm test:e2e   # integration (real DB/Redis/storage/models)
pnpm test:browser        # Playwright (run pnpm build first)
pnpm db:check-drift      # schema.prisma vs database (also in CI)
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
