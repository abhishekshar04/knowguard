import { evaluateSession, type SessionState, TOUCH_INTERVAL_MS } from './session-policy';

const HOUR = 60 * 60 * 1000;
const IDLE = 24 * HOUR;
const now = new Date('2026-09-29T12:00:00Z');

const base = (overrides: Partial<SessionState> = {}): SessionState => ({
  expiresAt: new Date(now.getTime() + 7 * 24 * HOUR),
  lastSeenAt: new Date(now.getTime() - 60_000),
  revokedAt: null,
  userStatus: 'ACTIVE',
  membershipStatus: 'ACTIVE',
  ...overrides,
});

describe('evaluateSession', () => {
  it('accepts an active, fresh session without touching it', () => {
    expect(evaluateSession(base(), now, IDLE)).toEqual({ valid: true, touch: false });
  });

  it('asks to refresh lastSeenAt once the touch interval has passed', () => {
    const session = base({ lastSeenAt: new Date(now.getTime() - TOUCH_INTERVAL_MS) });
    expect(evaluateSession(session, now, IDLE)).toEqual({ valid: true, touch: true });
  });

  it('rejects revoked sessions (logout)', () => {
    expect(evaluateSession(base({ revokedAt: new Date(now.getTime() - 1) }), now, IDLE)).toEqual({
      valid: false,
      reason: 'revoked',
    });
  });

  it('rejects sessions at or past their absolute expiry', () => {
    expect(evaluateSession(base({ expiresAt: now }), now, IDLE)).toMatchObject({ reason: 'expired' });
  });

  it('rejects sessions idle for longer than the idle timeout', () => {
    const session = base({ lastSeenAt: new Date(now.getTime() - IDLE) });
    expect(evaluateSession(session, now, IDLE)).toMatchObject({ reason: 'idle_timeout' });
  });

  it.each(['SUSPENDED', 'DEACTIVATED', 'INVITED'])('rejects sessions of %s accounts', (userStatus) => {
    expect(evaluateSession(base({ userStatus }), now, IDLE)).toMatchObject({ reason: 'account_inactive' });
  });

  it.each(['SUSPENDED', 'INVITED'])('rejects sessions whose membership is %s', (membershipStatus) => {
    expect(evaluateSession(base({ membershipStatus }), now, IDLE)).toMatchObject({
      reason: 'account_inactive',
    });
  });

  it('checks revocation before anything else', () => {
    const session = base({ revokedAt: now, expiresAt: now, userStatus: 'SUSPENDED' });
    expect(evaluateSession(session, now, IDLE)).toMatchObject({ reason: 'revoked' });
  });
});
