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
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
