import { sanitizeAuditMetadata } from './audit-metadata';

describe('sanitizeAuditMetadata', () => {
  it('keeps small, ordinary details', () => {
    expect(sanitizeAuditMetadata({ visibility: 'TEAM', count: 3, cited: true, ids: ['a', 'b'] })).toEqual({
      visibility: 'TEAM',
      count: 3,
      cited: true,
      ids: ['a', 'b'],
    });
  });

  it('redacts secret- or content-like keys at any depth', () => {
    const cleaned = sanitizeAuditMetadata({
      password: 'hunter2',
      sessionToken: 'abc',
      nested: { apiKey: 'sk-1', Authorization: 'Bearer x', question: 'salaries?', ok: 1 },
    });
    expect(cleaned).toEqual({
      password: '[redacted]',
      sessionToken: '[redacted]',
      nested: { apiKey: '[redacted]', Authorization: '[redacted]', question: '[redacted]', ok: 1 },
    });
    expect(JSON.stringify(cleaned)).not.toMatch(/hunter2|sk-1|Bearer|salaries/);
  });

  it('keeps counters and identifiers that merely contain sensitive words', () => {
    const kept = {
      promptTokens: 305,
      outputTokens: 36,
      messageId: 'm1',
      citedDocumentIds: ['d1'],
      tokenCount: 2,
    };
    expect(sanitizeAuditMetadata(kept)).toEqual(kept);
    expect(sanitizeAuditMetadata({ query: 'salaries', searchText: 'x', new_password: 'p' })).toEqual({
      query: '[redacted]',
      searchText: '[redacted]',
      new_password: '[redacted]',
    });
  });

  it('bounds strings, arrays, depth and total size', () => {
    const cleaned = sanitizeAuditMetadata({
      long: 'x'.repeat(500),
      list: Array.from({ length: 80 }, (_, i) => i),
      deep: { a: { b: { c: { d: 1 } } } },
    });
    expect((cleaned.long as string).length).toBe(201);
    expect(cleaned.list).toHaveLength(50);
    expect(cleaned.deep).toEqual({ a: { b: '[nested]' } });
    expect(sanitizeAuditMetadata({ many: Array.from({ length: 50 }, () => 'y'.repeat(200)) })).toEqual({
      truncated: true,
    });
  });

  it('drops undefined values and non-JSON types', () => {
    expect(sanitizeAuditMetadata({ a: undefined, b: () => 1, c: 2 })).toEqual({ c: 2 });
    expect(sanitizeAuditMetadata(undefined)).toEqual({});
  });
});
