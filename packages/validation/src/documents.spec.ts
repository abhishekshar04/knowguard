import { createDocumentSchema, setDocumentAclSchema, setDocumentVisibilitySchema } from './documents';

const ID_A = '0199a0a0-0000-7000-8000-00000000000a';
const ID_B = '0199a0a0-0000-7000-8000-00000000000b';

describe('document schemas', () => {
  it('defaults new documents to PRIVATE with no audience', () => {
    expect(createDocumentSchema.parse({ title: 'Runbook' })).toMatchObject({
      visibility: 'PRIVATE',
      audienceIds: [],
    });
  });

  it('accepts one or many audience IDs from multipart forms', () => {
    expect(setDocumentVisibilitySchema.parse({ visibility: 'TEAM', audienceIds: ID_A }).audienceIds).toEqual([
      ID_A,
    ]);
    expect(
      setDocumentVisibilitySchema.parse({ visibility: 'TEAM', audienceIds: [ID_A, ID_B] }).audienceIds,
    ).toEqual([ID_A, ID_B]);
  });

  it('rejects tenant and ownership fields on upload', () => {
    for (const key of ['organizationId', 'ownerId', 'status', 'storageKey']) {
      expect(createDocumentSchema.safeParse({ title: 'x', [key]: 'y' }).success).toBe(false);
    }
  });

  it('rejects contradictory ACL entries for the same subject and permission', () => {
    const entry = { subjectType: 'USER', subjectId: ID_A, permission: 'READ' };
    expect(
      setDocumentAclSchema.safeParse({
        entries: [
          { ...entry, effect: 'ALLOW' },
          { ...entry, effect: 'DENY' },
        ],
      }).success,
    ).toBe(false);
    expect(setDocumentAclSchema.parse({ entries: [entry] }).entries[0]?.effect).toBe('ALLOW');
  });

  it('rejects unknown subject types and actions', () => {
    expect(
      setDocumentAclSchema.safeParse({
        entries: [{ subjectType: 'GROUP', subjectId: ID_A, permission: 'READ' }],
      }).success,
    ).toBe(false);
    expect(
      setDocumentAclSchema.safeParse({
        entries: [{ subjectType: 'USER', subjectId: ID_A, permission: 'ADMIN' }],
      }).success,
    ).toBe(false);
  });
});
