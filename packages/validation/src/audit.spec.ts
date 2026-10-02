import { analyticsQuerySchema, auditQuerySchema } from './audit';

describe('auditQuerySchema', () => {
  it('parses query-string values with defaults', () => {
    expect(auditQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(auditQuerySchema.parse({ action: 'ACCESS_DENIED', limit: '10' })).toEqual({
      action: 'ACCESS_DENIED',
      limit: 10,
    });
  });

  it.each([
    [{ action: 'DROP_TABLE' }],
    [{ limit: '0' }],
    [{ limit: '101' }],
    [{ userId: 'not-a-uuid' }],
    [{ from: 'yesterday' }],
    [{ organizationId: '0190f7c8-6a2e-7c3a-9b1e-2f4a5c6d7e8f' }],
  ])('rejects %j', (query) => {
    expect(auditQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('analyticsQuerySchema', () => {
  it('accepts 7, 30 or 90 days', () => {
    expect(analyticsQuerySchema.parse({}).days).toBe(30);
    expect(analyticsQuerySchema.parse({ days: '7' }).days).toBe(7);
    expect(analyticsQuerySchema.safeParse({ days: '45' }).success).toBe(false);
  });
});
