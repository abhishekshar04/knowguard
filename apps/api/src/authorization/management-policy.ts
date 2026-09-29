/**
 * Privilege-escalation rules for member administration. Pure functions: callers load the
 * permission sets, these decide. Rules are expressed in PERMISSIONS, never role names, so
 * custom roles (Phase 4) are covered automatically.
 *
 *  1. Nobody changes their own roles or status (prevents self-escalation and self-lockout).
 *  2. You can only manage a member whose permissions are a subset of yours
 *     (an ADMIN cannot suspend or demote an OWNER).
 *  3. You can only grant a role whose permissions are a subset of yours
 *     (an ADMIN cannot make anyone OWNER).
 */

export type ManagementVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'SELF' | 'TARGET_HAS_MORE_ACCESS' | 'ROLE_EXCEEDS_YOUR_ACCESS' };

export function isSubset(subset: Iterable<string>, of: ReadonlySet<string>): boolean {
  for (const item of subset) if (!of.has(item)) return false;
  return true;
}

export interface Principal {
  userId: string;
  permissions: ReadonlySet<string>;
}

export function canManageMember(actor: Principal, target: Principal): ManagementVerdict {
  if (actor.userId === target.userId) return { allowed: false, reason: 'SELF' };
  if (!isSubset(target.permissions, actor.permissions)) {
    return { allowed: false, reason: 'TARGET_HAS_MORE_ACCESS' };
  }
  return { allowed: true };
}

export function canGrantRoles(
  actorPermissions: ReadonlySet<string>,
  roles: ReadonlyArray<{ permissions: Iterable<string> }>,
): ManagementVerdict {
  const exceeds = roles.some((role) => !isSubset(role.permissions, actorPermissions));
  return exceeds ? { allowed: false, reason: 'ROLE_EXCEEDS_YOUR_ACCESS' } : { allowed: true };
}

export const MANAGEMENT_DENIAL_MESSAGES: Record<
  Exclude<ManagementVerdict, { allowed: true }>['reason'],
  string
> = {
  SELF: 'You cannot change your own roles or status.',
  TARGET_HAS_MORE_ACCESS: 'You cannot manage a member who has access you do not have.',
  ROLE_EXCEEDS_YOUR_ACCESS: 'You cannot grant a role with permissions you do not hold.',
};

/** The permission that marks an organization owner; at least one active holder must remain. */
export const OWNERSHIP_PERMISSION = 'organization.update';
