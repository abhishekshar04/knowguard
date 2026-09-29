import { isPermissionKey, PERMISSION_KEYS, PERMISSIONS } from './permissions';
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from './system-roles';

const roleByKey = (key: string) => {
  const role = SYSTEM_ROLES.find((candidate) => candidate.key === key);
  if (!role) throw new Error(`missing role ${key}`);
  return role;
};

describe('permission catalog', () => {
  it('uses resource.action keys', () => {
    for (const key of PERMISSION_KEYS) {
      expect(key).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it('contains every permission required by the specification', () => {
    expect(PERMISSION_KEYS).toEqual(
      expect.arrayContaining([
        'organization.read',
        'organization.update',
        'user.read',
        'user.create',
        'user.update',
        'user.delete',
        'role.read',
        'role.create',
        'role.update',
        'role.delete',
        'document.read',
        'document.create',
        'document.update',
        'document.delete',
        'document.share',
        'audit.read',
        'ai.query',
      ]),
    );
    expect(PERMISSION_KEYS).toHaveLength(19); // 17 specified + department.manage, team.manage
  });

  it('recognises only catalog keys', () => {
    expect(isPermissionKey('document.read')).toBe(true);
    expect(isPermissionKey('document.admin')).toBe(false);
    expect(isPermissionKey('toString')).toBe(false);
    expect(isPermissionKey('__proto__')).toBe(false);
  });
});

describe('system roles', () => {
  it('defines exactly the four initial roles', () => {
    expect(SYSTEM_ROLES.map((role) => role.key)).toEqual([...SYSTEM_ROLE_KEYS]);
  });

  it('only references permissions from the catalog, without duplicates', () => {
    for (const role of SYSTEM_ROLES) {
      for (const permission of role.permissions) {
        expect(PERMISSIONS).toHaveProperty([permission]);
      }
      expect(new Set(role.permissions).size).toBe(role.permissions.length);
    }
  });

  it('grants OWNER every permission', () => {
    expect([...roleByKey('OWNER').permissions].sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it('forms a strict privilege hierarchy OWNER ⊃ ADMIN ⊃ MANAGER ⊃ EMPLOYEE', () => {
    const chain = ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE'].map((key) => new Set(roleByKey(key).permissions));
    for (let i = 1; i < chain.length; i++) {
      const higher = chain[i - 1]!;
      const lower = chain[i]!;
      for (const permission of lower) expect(higher.has(permission)).toBe(true);
      expect(higher.size).toBeGreaterThan(lower.size);
    }
  });

  it('keeps security administration away from non-admin roles', () => {
    const sensitive = [
      'user.create',
      'user.update',
      'user.delete',
      'role.create',
      'role.update',
      'role.delete',
      'audit.read',
      'department.manage',
      'team.manage',
    ];
    for (const key of ['MANAGER', 'EMPLOYEE']) {
      for (const permission of sensitive) {
        expect(roleByKey(key).permissions).not.toContain(permission);
      }
    }
  });
});
