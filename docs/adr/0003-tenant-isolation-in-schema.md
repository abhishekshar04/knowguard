# ADR 0003 — Tenant isolation enforced in the schema

**Status:** Accepted (Phase 1)

## Context

Every organization is an isolated tenant. Application-level `WHERE organization_id = ?` filters are necessary but can be forgotten. A bug that links Org A's user to Org B's role or team would grant cross-tenant access to data.

## Decision

1. **Every tenant-owned table has `organization_id`** (departments, teams, roles, user_organizations, department/team memberships, user_roles, sessions). `users` is a global identity (Phase 2, ADR 0005).
2. **Every tenant-owned table exposes a composite unique key `(id, organization_id)`.**
3. **Relationships between tenant-owned rows use composite foreign keys that include `organization_id`.** For example, `user_roles` has `(user_id, organization_id) → user_organizations(user_id, organization_id)` and `(role_id, organization_id) → roles(id, organization_id)`. Because both keys share one `organization_id` column, PostgreSQL rejects a role from an organization the user is not a member of. The same applies to team → department, department/team memberships and sessions.
4. **Roles are per-tenant rows.** OWNER/ADMIN/MANAGER/EMPLOYEE are provisioned into each organization (`is_system = true`) by `provisionSystemRoles`, so custom roles use the same code path and one tenant can never edit another's role.
5. **Permissions are a global catalog** (`permissions` table), seeded from `@knowguard/authorization`. They are system-defined capabilities, not tenant data. Business logic checks permission keys (`document.read`), never role names.
6. **Emails are globally unique** (stored lower-cased), so login identifies the account directly. Since Phase 2, tenancy lives in the `user_organizations` membership table (one organization per user for the MVP), so multi-organization users need no schema rewrite. See ADR 0005.
7. **Tenant context is derived server-side** from the authenticated session, which is bound to one membership (Phase 2). Organization IDs in request bodies are never trusted. No tenant context means the request is denied.

Tests in `packages/database/test/tenant-isolation.int-spec.ts` run against a real PostgreSQL and prove that cross-tenant inserts fail with FK violations.

## Consequences

- Join tables carry a redundant `organization_id`. This costs a few bytes per row and makes tenant-scoped queries and indexes straightforward.
- **Future work:** PostgreSQL Row-Level Security (per-request `SET app.organization_id`) adds a second layer on reads. It is deferred until the request-scoped Prisma client exists (Phase 3/4), to avoid designing it twice.
- Document tables (Phase 5) and chunk tables (Phase 6) must follow the same composite-key convention so that a chunk can never point to a document in another tenant.
