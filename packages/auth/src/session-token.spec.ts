import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from './session-token';

describe('session tokens', () => {
  it('generates unique, well-formed 256-bit tokens', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateSessionToken));
    expect(tokens.size).toBe(1000);
    for (const token of tokens) expect(isWellFormedSessionToken(token)).toBe(true);
  });

  it('hashes deterministically to 64 hex chars that do not contain the token', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it('rejects malformed tokens', () => {
    for (const value of ['', 'short', 'x'.repeat(43) + '!', `${'a'.repeat(42)}=`, 'a'.repeat(44)]) {
      expect(isWellFormedSessionToken(value)).toBe(false);
    }
  });
});
