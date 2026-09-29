import {
  ACTION_CAPABILITY,
  type AclEntry,
  type AuthorizationContext,
  type Decision,
  type ProtectedResource,
  type ResourceAction,
} from './types';

/**
 * The KnowGuard authorization engine: one pure function, no I/O, no framework.
 *
 * Evaluation order (first match wins) — spec §11:
 *
 *   1. Organization membership   resource in another tenant            → DENY  TENANT_MISMATCH
 *   2. Principal state           account or membership not ACTIVE      → DENY  INACTIVE_PRINCIPAL
 *   3. Role capability           e.g. READ needs "document.read"       → DENY  MISSING_CAPABILITY
 *   4. Explicit DENY             a DENY entry matches the caller        → DENY  EXPLICIT_DENY
 *   5. Explicit ALLOW            ownership, or an ALLOW entry matches  → ALLOW OWNER / EXPLICIT_ALLOW
 *   6. Inherited ALLOW           READ via visibility audience          → ALLOW INHERITED_ALLOW
 *   7. Default                                                         → DENY  DEFAULT_DENY
 *
 * So: Explicit DENY > Explicit ALLOW > Inherited ALLOW > DEFAULT DENY. Role capabilities are a
 * ceiling, not a grant — holding "document.read" never by itself opens a document.
 * There is deliberately no administrator bypass.
 *
 * Action implications (a single entry covers the obvious cases):
 *  - An ALLOW for WRITE, DELETE or SHARE also allows READ (you can't edit what you can't see).
 *  - A DENY for READ also denies WRITE, DELETE and SHARE (you can't act on what you can't see).
 */
export function authorize(
  context: AuthorizationContext,
  action: ResourceAction,
  resource: ProtectedResource,
): Decision {
  if (resource.organizationId !== context.organizationId) return deny('TENANT_MISMATCH');
  if (!context.active) return deny('INACTIVE_PRINCIPAL');
  if (!context.permissions.has(ACTION_CAPABILITY[action])) return deny('MISSING_CAPABILITY');

  const matching = resource.acl.filter((entry) => subjectMatches(context, entry));

  const denyEntry = matching.find(
    (entry) => entry.effect === 'DENY' && (entry.action === action || entry.action === 'READ'),
  );
  if (denyEntry) return { allowed: false, reason: 'EXPLICIT_DENY', entry: denyEntry };

  if (resource.ownerId === context.userId) return { allowed: true, reason: 'OWNER' };

  // PRIVATE means owner-only: explicit allows do not apply.
  if (resource.visibility !== 'PRIVATE') {
    const allowEntry = matching.find(
      (entry) =>
        entry.effect === 'ALLOW' &&
        (entry.action === action || (action === 'READ' && entry.action !== 'READ')),
    );
    if (allowEntry) return { allowed: true, reason: 'EXPLICIT_ALLOW', entry: allowEntry };
  }

  if (action === 'READ' && inheritsRead(context, resource)) {
    return { allowed: true, reason: 'INHERITED_ALLOW', visibility: resource.visibility };
  }

  return deny('DEFAULT_DENY');
}

/** Convenience for callers that only need the boolean. */
export function isAllowed(
  context: AuthorizationContext,
  action: ResourceAction,
  resource: ProtectedResource,
): boolean {
  return authorize(context, action, resource).allowed;
}

function deny(reason: Decision['reason']): Decision {
  return { allowed: false, reason };
}

function subjectMatches(context: AuthorizationContext, entry: AclEntry): boolean {
  switch (entry.subjectType) {
    case 'USER':
      return entry.subjectId === context.userId;
    case 'ROLE':
      return context.roleIds.has(entry.subjectId);
    case 'TEAM':
      return context.teamIds.has(entry.subjectId);
    case 'DEPARTMENT':
      return context.departmentIds.has(entry.subjectId);
  }
}

function inheritsRead(context: AuthorizationContext, resource: ProtectedResource): boolean {
  const audience = (ids: ReadonlySet<string>) => resource.audienceIds.some((id) => ids.has(id));
  switch (resource.visibility) {
    case 'ORGANIZATION':
      return true;
    case 'DEPARTMENT':
      return audience(context.departmentIds);
    case 'TEAM':
      return audience(context.teamIds);
    case 'ROLE':
      return audience(context.roleIds);
    case 'CUSTOM':
    case 'PRIVATE':
      return false;
  }
}
