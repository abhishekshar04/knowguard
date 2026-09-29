import { type Algorithm, hash, verify } from '@node-rs/argon2';

// `Algorithm` is an ambient const enum, which can't be read at runtime under isolatedModules.
const ARGON2ID = 2 as Algorithm.Argon2id;

/**
 * Argon2id parameters per the OWASP Password Storage Cheat Sheet
 * (m=19 MiB, t=2, p=1). Parameters are encoded in each hash, so raising
 * them later only affects newly hashed passwords.
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  if (plaintext.length === 0) {
    throw new Error('Refusing to hash an empty password');
  }
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Returns false (never throws) for a wrong password or a malformed/foreign hash,
 * so callers cannot accidentally distinguish "bad hash" from "bad password".
 */
export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext);
  } catch {
    return false;
  }
}
