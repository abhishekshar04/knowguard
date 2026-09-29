# ADR 0007 — Authorization engine and custom roles

**Status:** Accepted (Phase 4)

## Context

The core invariant is that no user ever receives content from a document they may not read. Phase 5 adds documents with visibility levels and per-document permissions (spec §12–13). Phase 7/8 retrieve document chunks for search and AI. All of these must share **one** definition of "may read".

## Decision: one pure engine

`@knowguard/authorization` exports `authorize(context, action, resource): Decision`. It is a pure function with no I/O and no framework, so it can be tested exhaustively and used identically by the API, the worker and future retrieval code.

- **`AuthorizationContext`** is built server-side from the session (`toAuthorizationContext`): user, organization, active flag, role permissions, and role, team and department IDs. The session query loads all of this on every request, so membership changes apply immediately.
- **`ProtectedResource`** holds the organization, owner, visibility, audience IDs (for ROLE/TEAM/DEPARTMENT visibility) and ACL entries. Each entry is `{subjectType: USER|ROLE|TEAM|DEPARTMENT, subjectId, action: READ|WRITE|DELETE|SHARE, effect: ALLOW|DENY}`.
- **`Decision`** is `{allowed, reason, entry?, visibility?}`. The reason (`EXPLICIT_DENY`, `INHERITED_ALLOW`, …) and the deciding entry feed `ACCESS_DENIED` / audit records in Phase 9.

### Evaluation order (first match wins)

| #   | Check                                                                                                                     | Outcome                   |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Resource in another organization                                                                                          | DENY `TENANT_MISMATCH`    |
| 2   | Account or membership not ACTIVE                                                                                          | DENY `INACTIVE_PRINCIPAL` |
| 3   | Missing role capability (READ→`document.read`, WRITE→`document.update`, DELETE→`document.delete`, SHARE→`document.share`) | DENY `MISSING_CAPABILITY` |
| 4   | A matching **DENY** entry                                                                                                 | DENY `EXPLICIT_DENY`      |
| 5   | Caller is the owner                                                                                                       | ALLOW `OWNER`             |
| 5   | A matching **ALLOW** entry (not for PRIVATE)                                                                              | ALLOW `EXPLICIT_ALLOW`    |
| 6   | READ, and caller is in the visibility audience                                                                            | ALLOW `INHERITED_ALLOW`   |
| 7   | Otherwise                                                                                                                 | DENY `DEFAULT_DENY`       |

This implements the required precedence: **Explicit DENY > Explicit ALLOW > Inherited ALLOW > Default DENY**.

### Semantics we chose (the spec leaves these open)

- **Role permissions are a ceiling, not a grant.** Holding `document.read` never opens a document by itself; the document's visibility or ACL must also allow it. Ownership is also capped: an owner without `document.delete` cannot delete.
- **No administrator bypass.** OWNER and ADMIN see only what visibility and ACLs allow. A future "view all documents" capability would be an explicit, audited permission.
- **Explicit DENY beats ownership.** This lets an administrator revoke access even from a document's owner.
- **Visibility grants READ only.** WRITE, DELETE and SHARE always require ownership or an explicit ALLOW.
- **Implications:** an ALLOW for WRITE, DELETE or SHARE also allows READ, and a DENY for READ also denies every other action (you can't act on what you can't see).
- **PRIVATE** means owner-only: ALLOW entries are ignored. **CUSTOM** means ACL-only: nobody inherits access.
- The spec's `DocumentPermission` has no deny concept. Phase 5 adds an `effect` column so explicit denies can be stored.

### Verification

- Scenario tests cover every case in the spec's testing section (same org with allowed and with denied role, explicit permission, explicit deny, department, team, cross-organization, suspended user) plus the semantics above.
- **Property-based tests** (fast-check, 2,000 random cases each) check the invariants: never across tenants, never while inactive, never without the capability, an applicable DENY always wins, PRIVATE is owner-only, visibility only grants READ, monotonicity (adding a DENY or removing a capability never grants), ACL order independence, and every grant is explained.
- A deliberate mutation (evaluating ownership before DENY) is caught by the suite.

### Phase 5 obligation: query-level equivalence

Listing and retrieval can't call `authorize()` on every row. Phase 5 must add a database filter ("documents readable by context") and a property test proving it returns **exactly** the documents for which `authorize(context, 'READ', doc).allowed` is true. The engine is the specification; the SQL filter is an optimization that must agree with it.

## Decision: custom roles

- `POST/PATCH/DELETE /roles` (requires `role.create/update/delete`); `GET /permissions` serves the catalog for the editor.
- Keys are derived from the name (`Support Lead` → `SUPPORT_LEAD`), are unique per organization, and can't reuse a built-in key.
- Rules, expressed in permissions like ADR 0006:
  - built-in roles are immutable (`SYSTEM_ROLE_IMMUTABLE`);
  - a role may only contain permissions the caller holds (`ROLE_EXCEEDS_YOUR_ACCESS`);
  - a role holding permissions the caller lacks can't be changed or deleted (`TARGET_HAS_MORE_ACCESS`);
  - you can't change a role you hold (`SELF`: no self-escalation or self-lockout);
  - a role still assigned to members can't be deleted (`ROLE_IN_USE`);
  - the organization must keep an active owner afterwards (`LAST_OWNER`).
- Edits take effect on each holder's next request.
- The UI has a Roles page (editor; permissions you don't hold are shown disabled) and a Permissions page (a read-only roles × permissions matrix).

## Deferred

- **PostgreSQL row-level security.** Tenant isolation currently rests on server-derived tenant context, tenant-filtered queries, composite foreign keys (ADR 0003) and cross-tenant tests. RLS needs a per-request tenant setting on the database connection and a separate path for the few cross-tenant lookups (login by email, session by token hash). It is best designed together with the Phase 5 document tables, where it protects the most sensitive data.
