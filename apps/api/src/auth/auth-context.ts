import type { AuthorizationContext } from '@knowguard/authorization';
import type { Request } from 'express';

/**
 * The authenticated principal for one request. Built exclusively server-side from the
 * session row — the tenant (organizationId) is never taken from client input.
 */
export interface AuthContext {
  sessionId: string;
  userId: string;
  organizationId: string;
  email: string;
  emailVerified: boolean;
  sessionExpiresAt: Date;
  /** Role keys held in organizationId (display only — never authorize on role names). */
  roles: readonly string[];
  /** Permission keys granted through those roles, loaded with the session on every request. */
  permissions: ReadonlySet<string>;
  /** Group memberships in organizationId, for the authorization engine (ACL subjects, audiences). */
  roleIds: ReadonlySet<string>;
  teamIds: ReadonlySet<string>;
  departmentIds: ReadonlySet<string>;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

/**
 * The engine's view of the caller. Sessions are only ever authenticated when account and
 * membership are ACTIVE (see session-policy.ts), so `active` is true for any AuthContext.
 */
export function toAuthorizationContext(auth: AuthContext): AuthorizationContext {
  return {
    userId: auth.userId,
    organizationId: auth.organizationId,
    active: true,
    permissions: auth.permissions,
    roleIds: auth.roleIds,
    teamIds: auth.teamIds,
    departmentIds: auth.departmentIds,
  };
}
