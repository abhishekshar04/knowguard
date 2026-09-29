import { isPermissionKey, type PermissionKey } from '@knowguard/authorization';
import { z } from 'zod';

const permissionKeys = z
  .array(z.string())
  .min(1, 'must include at least one permission')
  .max(100)
  .refine((keys) => keys.every(isPermissionKey), 'contains an unknown permission')
  .refine((keys) => new Set(keys).size === keys.length, 'must not contain duplicates')
  .transform((keys) => keys as PermissionKey[]);

export const createRoleSchema = z.strictObject({
  name: z.string().trim().min(2, 'must be at least 2 characters').max(100),
  description: z.string().trim().max(500).nullable().optional(),
  permissions: permissionKeys,
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = createRoleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'must change at least one field');
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/** "Support Lead" → "SUPPORT_LEAD": the stable machine key for a custom role. */
export function roleKeyFromName(name: string): string {
  const key = name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return key || 'CUSTOM_ROLE';
}
