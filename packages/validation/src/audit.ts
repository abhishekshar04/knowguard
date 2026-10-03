import { z } from 'zod';

import { uuidSchema } from './primitives';

const AUDIT_ACTIONS = [
  'DOCUMENT_VIEW',
  'DOCUMENT_DOWNLOAD',
  'DOCUMENT_CREATE',
  'DOCUMENT_UPDATE',
  'DOCUMENT_DELETE',
  'DOCUMENT_SHARE',
  'PERMISSION_CHANGE',
  'USER_CREATED',
  'USER_INVITED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'ROLE_CHANGED',
  'GROUP_CHANGED',
  'LOGIN',
  'LOGIN_FAILED',
  'ACCESS_DENIED',
  'SEARCH',
  'AI_QUERY',
] as const;

/** Query string of GET /audit-logs. Values arrive as strings. */
export const auditQuerySchema = z.strictObject({
  action: z.enum(AUDIT_ACTIONS).optional(),
  result: z.enum(['SUCCESS', 'DENIED', 'FAILURE']).optional(),
  resourceType: z
    .enum(['DOCUMENT', 'USER', 'ROLE', 'TEAM', 'DEPARTMENT', 'CONVERSATION', 'SESSION', 'ENDPOINT'])
    .optional(),
  resourceId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const analyticsQuerySchema = z.strictObject({
  days: z.coerce
    .number()
    .int()
    .refine((d) => d === 7 || d === 30 || d === 90, 'must be 7, 30 or 90')
    .default(30),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
