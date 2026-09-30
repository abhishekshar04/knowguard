import { z } from 'zod';

export const searchRequestSchema = z.strictObject({
  query: z.string().trim().min(1, 'is required').max(500),
  limit: z.number().int().min(1).max(50).default(10),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;
