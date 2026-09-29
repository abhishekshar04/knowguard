/** Pure session-validity rules, separated from I/O so they are exhaustively unit-testable. */

export interface SessionState {
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  userStatus: string;
  membershipStatus: string;
}

export type SessionVerdict =
  | { valid: true; touch: boolean }
  | { valid: false; reason: 'revoked' | 'expired' | 'idle_timeout' | 'account_inactive' };

/** lastSeenAt is refreshed at most this often, to avoid a database write per request. */
export const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function evaluateSession(session: SessionState, now: Date, idleTimeoutMs: number): SessionVerdict {
  if (session.revokedAt) return { valid: false, reason: 'revoked' };
  if (now.getTime() >= session.expiresAt.getTime()) return { valid: false, reason: 'expired' };
  const idleFor = now.getTime() - session.lastSeenAt.getTime();
  if (idleFor >= idleTimeoutMs) return { valid: false, reason: 'idle_timeout' };
  // Suspension/deactivation of the account or the membership takes effect on the next request.
  if (session.userStatus !== 'ACTIVE' || session.membershipStatus !== 'ACTIVE') {
    return { valid: false, reason: 'account_inactive' };
  }
  return { valid: true, touch: idleFor >= TOUCH_INTERVAL_MS };
}
