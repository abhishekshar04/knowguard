# ADR 0002 — Pinned framework versions

**Status:** Accepted (Phase 1, September 2026)

Dependencies are pinned to exact versions. Where the newest major was not chosen, the reason is below.

| Choice                 | Instead of      | Why                                                                                                                                                                                                                                        |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NestJS 11.2            | NestJS 12       | Nest 12 is ESM-only. Jest, Prisma 6 and the CommonJS internal packages all work without friction on 11, which is still maintained. Revisit when moving the repo to ESM.                                                                    |
| Prisma 6.19            | Prisma 7 / 8 RC | npm's `latest` tag points to an 8.0 release candidate. Prisma 7 requires driver adapters and a new generator; 6.19 is mature and has full `pgvector`-via-raw-SQL support. `prisma.config.ts` is already used, which eases a later upgrade. |
| TypeScript 5.9         | TypeScript 7    | TS 7 is the native (Go) compiler without the JS compiler API that Nest CLI, ts-jest and typescript-eslint depend on.                                                                                                                       |
| ESLint 9 (flat config) | ESLint 10       | `eslint-config-next` and plugins are verified on 9.                                                                                                                                                                                        |

Current majors are used elsewhere: Next.js 16, React 19, Tailwind CSS 4, Jest 30, BullMQ 6, zod 4, Turborepo 2, pnpm 10.

PostgreSQL runs as `pgvector/pgvector:pg17`, so the vector extension is available for Phase 6 without an infrastructure change.
