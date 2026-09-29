import { createHash, randomBytes } from 'node:crypto';

/** 256 bits of entropy: infeasible to guess, so a fast hash is sufficient for storage. */
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Generates a new opaque session token (base64url, 43 chars). Only ever sent to the client. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Hash stored in the database instead of the token. SHA-256 (not argon2) is correct here:
 * the input is high-entropy random data, and lookups must be by exact hash.
 * A database leak therefore yields no usable session tokens.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Cheap shape check to reject garbage before touching the database. */
export function isWellFormedSessionToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
