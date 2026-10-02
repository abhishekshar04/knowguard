import { RESOURCE_ACTIONS, SUBJECT_TYPES, VISIBILITIES } from '@knowguard/authorization';
import { z } from 'zod';

import { uuidSchema } from './primitives';

const title = z.string().trim().min(1, 'is required').max(300);
const description = z.string().trim().max(5000).nullable().optional();
const visibility = z.enum(VISIBILITIES);

/** Multipart forms send one value as a string and several as an array; accept both. */
const idList = z
  .union([uuidSchema, z.array(uuidSchema)])
  .optional()
  .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]))
  .pipe(
    z
      .array(uuidSchema)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, 'must not contain duplicates'),
  );

/** Metadata fields of the multipart upload (the file itself is validated separately). */
export const createDocumentSchema = z.strictObject({
  title,
  description: description.transform((value) => (value === '' ? null : value)),
  visibility: visibility.default('PRIVATE'),
  audienceIds: idList,
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z
  .strictObject({ title: title.optional(), description })
  .refine((value) => Object.keys(value).length > 0, 'must change at least one field');
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

/** Visibility decides who INHERITS read access; audienceIds apply to ROLE/TEAM/DEPARTMENT. */
export const setDocumentVisibilitySchema = z.strictObject({ visibility, audienceIds: idList });
export type SetDocumentVisibilityInput = z.infer<typeof setDocumentVisibilitySchema>;

export const aclEntrySchema = z.strictObject({
  subjectType: z.enum(SUBJECT_TYPES),
  subjectId: uuidSchema,
  permission: z.enum(RESOURCE_ACTIONS),
  effect: z.enum(['ALLOW', 'DENY']).default('ALLOW'),
});
export type AclEntryInput = z.infer<typeof aclEntrySchema>;

/** Replaces the whole ACL. One entry per (subject, permission): no ambiguous ALLOW+DENY pairs. */
export const setDocumentAclSchema = z.strictObject({
  entries: z
    .array(aclEntrySchema)
    .max(200)
    .refine(
      (entries) =>
        new Set(entries.map((e) => `${e.subjectType}:${e.subjectId}:${e.permission}`)).size ===
        entries.length,
      'must not contain two entries for the same subject and permission',
    ),
});
export type SetDocumentAclInput = z.infer<typeof setDocumentAclSchema>;

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  /** Narrows the caller's readable documents; never widens them. */
  status: z.enum(['UPLOADING', 'PROCESSING', 'INDEXING', 'READY', 'FAILED', 'ARCHIVED']).optional(),
  /** Case-insensitive title match. */
  q: z.string().trim().min(1).max(200).optional(),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
