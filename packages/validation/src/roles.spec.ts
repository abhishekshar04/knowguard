import { createRoleSchema, roleKeyFromName, updateRoleSchema } from './roles';

describe('role schemas', () => {
  const valid = { name: 'Support Lead', permissions: ['document.read', 'ai.query'] };

  it('accepts catalog permissions', () => {
    expect(createRoleSchema.parse(valid).permissions).toEqual(['document.read', 'ai.query']);
  });

  it.each([
    [['document.read', 'document.superpower'], 'unknown permission'],
    [['document.read', 'document.read'], 'duplicates'],
    [[], 'empty'],
  ])('rejects %p (%s)', (permissions) => {
    expect(createRoleSchema.safeParse({ ...valid, permissions }).success).toBe(false);
  });

  it('rejects client-supplied keys and flags', () => {
    expect(createRoleSchema.safeParse({ ...valid, key: 'OWNER' }).success).toBe(false);
    expect(createRoleSchema.safeParse({ ...valid, isSystem: true }).success).toBe(false);
  });

  it('rejects empty updates', () => {
    expect(updateRoleSchema.safeParse({}).success).toBe(false);
  });
});

describe('roleKeyFromName', () => {
  it.each([
    ['Support Lead', 'SUPPORT_LEAD'],
    ['  légal & compliance ', 'LEGAL_COMPLIANCE'],
    ['***', 'CUSTOM_ROLE'],
  ])('%p → %p', (name, key) => {
    expect(roleKeyFromName(name)).toBe(key);
  });
});
