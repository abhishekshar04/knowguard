import { z } from 'zod';

import { emailSchema, passwordSchema } from './primitives';

const displayName = z.string().trim().min(1, 'is required').max(200);

/**
 * Strict objects: unknown keys (e.g. a client-supplied `organizationId`, `role` or `status`)
 * are rejected rather than silently ignored, so mass-assignment attempts fail loudly.
 */
export const registerSchema = z.strictObject({
  name: displayName,
  email: emailSchema,
  password: passwordSchema,
  organizationName: z.string().trim().min(2, 'must be at least 2 characters').max(200),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Login does not re-apply the password policy (old passwords stay valid); it only bounds size. */
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;
