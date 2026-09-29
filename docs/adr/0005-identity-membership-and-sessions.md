# ADR 0005 — Identity, membership, sessions and the BFF

**Status:** Accepted (Phase 2). Implements the Phase 2 decision contract.

## Identity and membership

- **`users` is a global identity** (email, password hash, account status, `email_verified_at`). It has no `organization_id`.
- **`user_organizations` is the membership** of a user in a tenant, with its own `status` (ACTIVE / INVITED / SUSPENDED). Every tenant-scoped relation of a user (`user_roles`, `department_memberships`, `team_memberships`, `sessions`) references the membership through the composite key `(user_id, organization_id)`. PostgreSQL therefore rejects a role, team or session in an organization the user doesn't belong to (see ADR 0003).
- **MVP: one organization per user**, enforced by the unique index `user_organizations_single_org_per_user_key`. Supporting multi-organization users means dropping that index, adding an organization switcher (a session is already bound to one membership), and choosing a membership at login. No authentication rewrite is needed.
- **Emails are globally unique** and stored lower-cased, so login identifies the account directly.
- **Two independent statuses.** `users.status` is the account state across all organizations. `user_organizations.status` is the state in one organization. Both must be ACTIVE to log in or use a session.

## Registration

Self-serve. `POST /auth/register` validates the input and then, in **one transaction**, creates the user (ACTIVE, email unverified), the organization (with a slug derived from its name and a random suffix on collision), the four system roles, an ACTIVE membership, the OWNER role assignment, and a session. The permission catalog is synced at API boot, not on every signup.

Registration necessarily reveals when an email is already taken (`409 EMAIL_UNAVAILABLE`). A per-IP limit bounds this enumeration. Moving to "check your inbox" signup, where every submission looks identical, requires sending email and is scheduled together with email verification.

## Sessions

- The token is 32 random bytes (base64url). Only its **SHA-256 hash** is stored in `sessions.token_hash`. A fast hash is correct for high-entropy tokens and lets the API look sessions up by hash. A database leak yields no usable tokens.
- **Absolute expiry** is set by `SESSION_TTL_HOURS` (default 7 days). **Idle expiry** is set by `SESSION_IDLE_TIMEOUT_MINUTES` (default 24 h), measured from `last_seen_at`, which is refreshed at most every 5 minutes.
- **Every request re-validates** revocation, expiry, idle timeout, account status and membership status (`session-policy.ts`). Logout, suspension and deactivation take effect on the next request, and the session is marked revoked with a reason.
- `SessionService.revokeAllForUser` exists for suspension and password changes (Phase 3).
- Each session is bound to one membership, and that membership is the request's tenant context. The API never reads an organization ID from client input.
- A session is issued at login and registration only, so session fixation isn't possible.

## Authentication in the API

- A global `SessionAuthGuard` authenticates **every route by default**. Routes opt out with `@Public()` (currently register, login and health). A forgotten decorator therefore fails closed.
- `@RequireVerifiedEmail()` marks operations that need a verified email (`403 EMAIL_NOT_VERIFIED`). Unverified users get a working but limited session.
- The API accepts only `Authorization: Bearer <token>`. It ignores cookies and has **no CORS**. Browsers cannot call it directly with credentials.

## Browser → Next.js BFF → API

- The browser talks only to Next.js (same origin). Server actions call the API server-to-server and store the token in a cookie:
  - `__Host-kg_session` in production (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, host-only);
  - `kg_session` without `Secure` in local HTTP development (`SESSION_COOKIE_SECURE` overrides).
- **CSRF:** Next.js server actions reject cross-origin requests (Origin must match Host). `SameSite=Lax` stops the cookie from being sent on cross-site POSTs. Sign-out is a POST form, not a link.
- **Authoritative checks:** protected layouts and pages call `requireUser()`, which asks the API (`GET /auth/me`). `proxy.ts` only makes an optimistic redirect when there is no cookie and is not a security boundary.
- Post-login redirects accept only same-origin relative paths, which prevents open redirects.

## Rate limiting and brute force

Fixed-window counters in Redis (`RateLimiterService`), shared by all API instances:

| Limit                                    | Key                          | Default                                        |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------- |
| Login attempts per client IP             | `login:ip:<ip>`              | 30 / 15 min                                    |
| **Failed** logins per email, from any IP | `login:fail:<sha256(email)>` | 10 / 15 min, then locked until the window ends |
| Registrations per client IP              | `register:ip:<ip>`           | 5 / hour                                       |

- The per-email lock applies to unknown emails too, so lockout reveals nothing. It is time-boxed rather than permanent, so an attacker can't lock a victim out indefinitely. Emails are hashed in Redis keys.
- **Fail-closed:** if Redis is unavailable, login and registration return `503` rather than silently losing brute-force protection.
- **Generic failures:** unknown email, wrong password, no password set, suspended or deactivated account, and no active membership all return the same `401 INVALID_CREDENTIALS` body. They also do the same work: an unknown email is verified against a dummy argon2 hash.

### Client IP and deployment requirement

The BFF forwards the client IP to the API as `X-Forwarded-For`, using the **rightmost** hop of the header it received. The API trusts that header only from `TRUST_PROXY` hops (default `loopback`).

Next.js does not append to `X-Forwarded-For`. It only fills it in when the header is absent. **In production the web app must run behind a reverse proxy or load balancer that sets or appends `X-Forwarded-For`**, and `TRUST_PROXY` must name the BFF's address or subnet. Otherwise clients can spoof their IP and evade the per-IP limits. The per-email lock still protects accounts either way.

## Not yet implemented (tracked)

- Sending verification emails, and verification-based signup (removes registration enumeration).
- Password reset. The rate limiter is ready for it.
- A worker job to purge expired and revoked sessions.
- CAPTCHA, to be introduced only if abuse patterns justify it.
