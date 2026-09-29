# ADR 0004 — Credentials, secrets and API errors

**Status:** Accepted (Phase 1). The session design below is proposed and will be finalised in Phase 2.

## Passwords

- Hashed with **argon2id** (`@node-rs/argon2`, which ships prebuilt binaries and needs no native toolchain) using the OWASP parameters m = 19 MiB, t = 2, p = 1. The parameters are encoded in each hash.
- `verifyPassword` never throws. A malformed hash counts as a failed verification.
- `users.password_hash` is nullable, for invited users and future SSO-only accounts.
- Password policy is length-based (12–128 characters, per NIST 800-63B). The upper bound limits the hashing cost of hostile input.

## Sessions (proposed for Phase 2)

Opaque random session tokens in an `HttpOnly; Secure; SameSite=Lax` cookie, stored **hashed** in a `sessions` table with expiry and revocation. We prefer this to stateless JWTs because suspension, deactivation and logout must take effect immediately. The auth package keeps the credential verifier separate from session issuance, so Google/Microsoft OAuth and SAML/OIDC SSO can be added as further verifiers.

## Secrets and logging

- No secret appears in source code. `.env` is git-ignored, and `.env.example` contains only local placeholders.
- Environment validation reports variable names, never values.
- The shared pino logger redacts passwords, hashes, tokens, `Authorization` and `Cookie` headers.
- Redis requires a password even in local development, and both containers bind to `127.0.0.1` only.

## API errors

Every error returns `{ "error": { "code", "message" } }`. The global filter:

- passes `ApiException` codes and messages through (these are written to be client-safe),
- maps framework and body-parser errors (400, 404, 413, ...) to fixed generic messages, so it never echoes paths, SQL, stack traces or parser internals,
- turns everything else into `500 INTERNAL_ERROR` and logs the details server-side.

Messages must not reveal whether a resource exists in another tenant. Cross-tenant lookups return the same `NOT_FOUND` as missing resources.
