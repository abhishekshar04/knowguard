# ADR 0006 — Minimal RBAC, invitations and organization structure

**Status:** Accepted (Phase 3)

## Context

Phase 3 adds member administration (invite, suspend, change roles) and organization structure (departments, teams). These endpoints need authorization now. The full policy engine (document ACLs, explicit denies, department/team scoping) is Phase 4.

## Decisions

### Capability checks: `@RequirePermission()`

- The session query also loads the member's role grants, so `AuthContext.permissions` is available on every request at no extra round-trip. A role change or suspension therefore takes effect on the member's **next request**.
- `@RequirePermission('user.create', …)` requires **all** listed permissions. It is checked by the global `SessionAuthGuard` after authentication: no session gives 401, a missing permission gives 403 `FORBIDDEN`. The 403 never names the missing permission.
- Business logic checks permission keys, never role names. Phase 4 extends evaluation (ACLs, denies) behind the same decorator.
- Two permissions were added to the catalog: `department.manage` and `team.manage`. They let organization structure be delegated to ADMIN without granting `organization.update`. OWNER and ADMIN hold them; a data migration granted them in existing organizations.

### Privilege-escalation rules (`management-policy.ts`)

These are expressed purely in permissions, so they also cover custom roles:

1. **Nobody changes their own roles or status** (`SELF`). This prevents both self-escalation and self-lockout.
2. **You can only manage members whose permissions are a subset of yours** (`TARGET_HAS_MORE_ACCESS`). An ADMIN cannot suspend or demote an OWNER.
3. **You can only grant roles whose permissions are a subset of yours** (`ROLE_EXCEEDS_YOUR_ACCESS`). An ADMIN cannot make anyone OWNER.
4. **At least one active owner must remain** (`LAST_OWNER`). An owner is a member holding `organization.update`. Rules 1–2 already make removing the last owner impossible with system roles; the check is defense in depth for custom roles.

The API also returns `manageable` (per member) and `assignable` (per role) so the UI can hide controls. These are hints only: every change is re-checked server-side.

### Invitations (no email provider yet)

- The admin enters name, email and role. The API creates an `INVITED` user, an `INVITED` membership, the role assignment, and a **one-time token** (256-bit, SHA-256-hashed at rest, valid 7 days).
- The link (`/invite/<token>`) is **shown once** to the admin, who shares it. When email is added, the same token will simply be emailed.
- Accepting sets the invitee's own password (the admin never knows it), activates the account and membership, and signs the invitee in. The claim is a conditional update, so two concurrent accepts can't both succeed.
- Re-issuing a link revokes the previous one. Suspending an invited member revokes their link too.
- Every invalid case (unknown, expired, revoked, used, suspended) returns one `INVITATION_INVALID` response. Preview and accept are rate-limited per IP; invitation creation is rate-limited per organization.
- The invite page sets `Referrer-Policy: no-referrer` and `noindex`, because its URL contains a secret.
- **MVP limit:** an email that already has an account (in any organization) can't be invited (`409 EMAIL_UNAVAILABLE`). This follows from one organization per user (ADR 0005).
- Accepting an invitation does **not** mark the email verified, because the admin shared the link out-of-band. Verification arrives with email sending.

### Suspension

Suspension is **per membership**. It revokes the member's sessions in that organization and any outstanding invitation. Reactivation restores `ACTIVE`, or `INVITED` if the member never set a password.

### Tenant scoping

- There is no `/organizations/:id` route. `/organization` is always the session's organization.
- Every lookup by ID is filtered by `auth.organizationId`. An ID from another organization gets the **same 404 body** as a missing ID, so IDs can't be probed across tenants. Malformed IDs also get 404 (`ParseIdPipe`), not a distinguishable 400.
- Composite foreign keys (ADR 0003) back this up at the database level.

### Organization structure

- Departments contain teams. A department can't be deleted while it has teams (`409 DEPARTMENT_NOT_EMPTY`), so teams are never silently dropped.
- Names are unique per organization (departments) and per department (teams).
- Structure is readable by every member (`organization.read`). Team and department membership will drive team- and department-restricted documents in Phase 4/5.
- Organization slugs are immutable after creation; only the name can change.

### Directory visibility

EMPLOYEE holds `user.read` (since Phase 1), so every member can see the member directory, including status, roles, groups and last sign-in. Admin navigation appears only for members holding the management permissions. If the directory should be narrower, remove `user.read` from EMPLOYEE or introduce a restricted directory view in Phase 4.

## Not in Phase 3

- Custom roles (`role.create/update/delete`): Phase 4.
- Removing or deleting members (`user.delete`): suspension covers offboarding for now.
- Audit logging of administrative actions: Phase 9. The audit model will record invites, role changes and suspensions.
- Email delivery of invitations and email verification.
