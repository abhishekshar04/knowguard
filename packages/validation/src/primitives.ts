import { z } from 'zod';

/** Emails are compared case-insensitively; normalise once at the boundary. */
export const emailSchema = z
  .string()
  .trim()
  .max(320)
  .pipe(z.email())
  .transform((value) => value.toLowerCase());

/**
 * Password policy (NIST SP 800-63B): length over composition rules.
 * The 128-char cap bounds hashing cost for hostile input.
 */
export const passwordSchema = z
  .string()
  .min(12, 'must be at least 12 characters')
  .max(128, 'must be at most 128 characters');

/** URL-safe organization slug: lowercase alphanumerics separated by single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase letters, digits and single hyphens');

export const uuidSchema = z.uuid();
