import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces an argon2id hash that does not contain the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse');
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password-123'), hashPassword('same-password-123')]);
    expect(a).not.toBe(b);
  });

  it('verifies the correct password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'Correct horse battery staple')).resolves.toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    await expect(verifyPassword('not-a-hash', 'whatever')).resolves.toBe(false);
  });

  it('refuses to hash an empty password', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });
});
