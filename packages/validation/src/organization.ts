import { z } from 'zod';

import { emailSchema, passwordSchema, uuidSchema } from './primitives';

/*
 * Request schemas for organization administration (Phase 3). All objects are strict: unknown
 * keys — e.g. a client-supplied organizationId or status — are rejected, never ignored.
 */

const name = z.string().trim().min(1, 'is required').max(200);
const description = z.string().trim().max(1000).nullable().optional();
const roleKey = z.string().trim().min(1).max(64);

export const updateOrganizationSchema = z.strictObject({
  name: z.string().trim().min(2, 'must be at least 2 characters').max(200),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const inviteMemberSchema = z.strictObject({
  name,
  email: emailSchema,
  roleKey,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRolesSchema = z.strictObject({
  roleKeys: z
    .array(roleKey)
    .min(1, 'must include at least one role')
    .max(10)
    .refine((keys) => new Set(keys).size === keys.length, 'must not contain duplicates'),
});
export type UpdateMemberRolesInput = z.infer<typeof updateMemberRolesSchema>;

export const acceptInvitationSchema = z.strictObject({
  password: passwordSchema,
  /** Invitees may correct the name the admin typed. */
  name: name.optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const createDepartmentSchema = z.strictObject({ name, description });
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'must change at least one field');
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const createTeamSchema = z.strictObject({ name, description, departmentId: uuidSchema });
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'must change at least one field');
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
