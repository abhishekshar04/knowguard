# ADR 0013 — Security hardening and regression suites

**Status:** Accepted (Phase 10)

The earlier phases built the security model: tenant isolation (ADR 0003), sessions and the BFF (0005), the authorization engine (0007), permission-aware retrieval (0010, 0011) and auditing (0012). This phase adds checks that keep that model intact while the product grows. Heavy frontend work comes next, so the checks are **automatic**: they cover new endpoints and pages without anyone remembering to add a test.

## 1. Route sweeps (API)

`apps/api/test/route-inventory.ts` reads every HTTP route of the running application from the same decorator metadata the global guard uses. `apps/api/test/security.e2e-spec.ts` then checks every route:

| Check                 | Rule                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route policy          | Public routes must match a reviewed list exactly. Every other route declares a capability with `@RequirePermission`, except two session-only routes (`/auth/me`, `/auth/logout`). Adding a public or capability-less route fails CI until the list is deliberately updated.                                  |
| Authentication        | Every non-public route answers 401 `UNAUTHENTICATED` to: no token, a malformed token, and an unknown token.                                                                                                                                                                                                  |
| Capabilities          | For each built-in role (ADMIN, MANAGER, EMPLOYEE) and a minimal custom role, every route requiring a capability the role lacks answers 403 `FORBIDDEN`.                                                                                                                                                      |
| Tenant isolation      | The owner of another organization, who holds every capability, calls every parameterised route with the victim organization's IDs and gets a 404, identical to a missing resource. The test fails if a parameterised route has no case, so new endpoints get one. Afterwards the victim's data is unchanged. |
| Foreign IDs in bodies | Sharing with, setting audiences to, or assigning another organization's users, roles, teams, departments, documents or conversations is refused.                                                                                                                                                             |
| Lists and search      | No list, search or audit view returns another organization's IDs.                                                                                                                                                                                                                                            |

A planted regression (removing `@RequirePermission` from one route) fails the suite, which shows the sweep works.

## 2. Per-member API rate limit

All authenticated requests count against a per-member budget: 600 per minute, of which 120 may be changes (non-GET). The global guard enforces it, counting per user across all of their sessions. It is configurable with `API_RATE_LIMIT_PER_MINUTE` and `API_WRITE_RATE_LIMIT_PER_MINUTE`, and the stricter existing limits on login, registration, invitations, search and Ask AI still apply on top.

This limit **fails open** if Redis is unavailable: availability of the whole API matters more than this broad limit. The brute-force limits keep failing **closed**, as before.

## 3. Prompt-injection hardening

All untrusted text that reaches a prompt goes through `sanitizeUntrusted()`: document content, titles, sections, the question and earlier turns. It applies these steps in order:

1. **NFKC normalization.** Look-alikes such as full-width `＜／source＞` become ASCII before the checks below.
2. **Remove invisible and control characters.** Unicode category Cf (zero-width characters, bidi overrides, BOM) and C0/C1 control characters go, so a delimiter cannot be hidden.
3. **Neutralize chat-template tokens.** `<|…|>` (ChatML and Llama 3), `[INST]` and `<<SYS>>` (Llama 2), and `<start_of_turn>` (Gemma) are broken up. Hosted APIs treat these as plain text, but a self-hosted server behind `OPENAI_BASE_URL` may render the prompt as one string, where they would start a new role.
4. **Neutralize source delimiters**, as before.

`src/ai/prompt-injection.spec.ts` is a regression corpus of eleven tricks. Each is placed in a document, a title, the history and the question, and the prompt's structure must survive all of them. Add new tricks to it when they are found.

These defences only shape the model's input. The security boundary is still retrieval: the model only ever sees passages the user may read (ADR 0011).

## 4. Browser hardening

**Content-Security-Policy** (`apps/web/proxy.ts`), set per request:

```
default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…';
style-src-attr 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self';
frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

`upgrade-insecure-requests` is added when served over HTTPS, and `unsafe-eval` only in `next dev`.

- **Nonces:** Next.js applies the nonce to its own scripts. Nonces need per-request rendering, so the root layout awaits `connection()`. Every page is per-user anyway.
- **Inline style attributes are allowed:** they cannot run code, and components such as charts set computed sizes.
- **Document files** keep their own sandboxed policy (ADR 0008).

**Our own error pages.** Next.js's built-in 404 and error pages use inline `<style>` tags, which the policy blocks. The browser tests caught this, so the app now has `not-found.tsx`, `error.tsx` and `global-error.tsx`. The 404 page is worded for both "missing" and "no access", matching the API.

**Response headers** on every response:

- `Strict-Transport-Security` (2 years). Browsers ignore it over plain HTTP.
- `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- A restrictive `Permissions-Policy`.

**Lint guardrails** (`apps/web/eslint.config.mjs`) are errors, not warnings:

- `react/no-danger` (`dangerouslySetInnerHTML`), `javascript:` URLs, `target="_blank"` without `rel="noreferrer"`.
- `eval` and `new Function`.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write`.
- `document.cookie`, `localStorage` and `sessionStorage`.
- `NEXT_PUBLIC_` environment variables.
- Importing the API client or session helpers outside server code.

**Browser bundle check** (`pnpm --filter @knowguard/web check:bundle`, in CI after the build). It fails if `.next/static` contains:

- the name of a server-only setting (`API_URL`, `DATABASE_URL`, `OPENAI_API_KEY`, …), which would mean server code was bundled for the browser;
- the actual value of a secret setting;
- anything shaped like a credential.

**Browser test guard** (`apps/web/e2e/fixtures.ts`): every browser test imports `test` from here. The guard fails a test if any page it opened, including pages in other users' browser contexts, throws an uncaught error or reports a CSP violation. `e2e/security.spec.ts` checks:

- the policy, the per-request nonce and the headers;
- that a document whose title and body contain `<img onerror>`, `<script>` and `<svg onload>` shows as plain text on the document page, lists, search, Ask AI sources, the audit log and the dashboard.

## 5. Supply chain and secrets

- **`pnpm security:secrets`** (`scripts/check-secrets.mjs`) scans every file git would commit for credential patterns, and for files that must never be committed (`.env`, private keys). It is the first CI step.
- **`pnpm security:audit`** fails CI on high or critical advisories in production dependencies. One was present: `deepmerge-ts` < 8 (GHSA-ggr8-5vv4-36mx), pulled in through Prisma's config loader. It is fixed with a pnpm override to 8.x; Prisma's CLI (validate, generate, migrate, drift check) was verified with it.

## Considered and deferred

- **PostgreSQL row-level security.** It would be a second, database-level tenant boundary. Isolation already rests on composite tenant foreign keys (ADR 0003), every query being scoped by the session's organization, and now a sweep proving it for every route. RLS with Prisma needs a per-transaction tenant setting on every query, which is a substantial change across the data layer. It remains the next step if a deployment requires defence in depth at the database.
- **SQL-side permission filter for search at large scale** (ADR 0010). This is a performance change, not a security one; the current filter is exact.
- **CSP violation reporting endpoint** (`report-to`). Useful in production to spot breakage or attacks, once there is somewhere to send reports.
