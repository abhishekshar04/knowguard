import { z } from 'zod';

import { uuidSchema } from './primitives';

export const aiQuerySchema = z.strictObject({
  message: z.string().trim().min(1, 'is required').max(4000),
  /** Continue an existing conversation (must be the caller's own). */
  conversationId: uuidSchema.optional(),
  /** "Ask AI about this document": restrict retrieval to one readable document. */
  documentId: uuidSchema.optional(),
});
export type AiQueryInput = z.infer<typeof aiQuerySchema>;
