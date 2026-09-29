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
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
