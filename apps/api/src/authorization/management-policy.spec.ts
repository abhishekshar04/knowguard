import { SYSTEM_ROLES } from '@knowguard/authorization';

import { canGrantRoles, canManageMember, isSubset } from './management-policy';

const perms = (key: string) => new Set(SYSTEM_ROLES.find((role) => role.key === key)!.permissions);
const OWNER = perms('OWNER');
const ADMIN = perms('ADMIN');
const MANAGER = perms('MANAGER');
const EMPLOYEE = perms('EMPLOYEE');

const principal = (userId: string, permissions: Set<string>) => ({ userId, permissions });

describe('isSubset', () => {
  it('treats the empty set as a subset of anything', () => {
    expect(isSubset([], new Set())).toBe(true);
  });
  it('detects a missing element', () => {
    expect(isSubset(['a', 'b'], new Set(['a']))).toBe(false);
  });
});

describe('canManageMember', () => {
  it('forbids managing yourself, even as OWNER', () => {
    expect(canManageMember(principal('u1', OWNER), principal('u1', OWNER))).toEqual({
      allowed: false,
      reason: 'SELF',
    });
  });

  it.each([
    ['OWNER', OWNER, 'OWNER', OWNER],
    ['OWNER', OWNER, 'ADMIN', ADMIN],
    ['ADMIN', ADMIN, 'ADMIN', ADMIN],
    ['ADMIN', ADMIN, 'MANAGER', MANAGER],
    ['ADMIN', ADMIN, 'EMPLOYEE', EMPLOYEE],
  ])('%s may manage %s', (_a, actor, _t, target) => {
    expect(canManageMember(principal('actor', actor), principal('target', target)).allowed).toBe(true);
  });

  it.each([
    ['ADMIN', ADMIN, 'OWNER', OWNER],
    ['MANAGER', MANAGER, 'ADMIN', ADMIN],
    ['EMPLOYEE', EMPLOYEE, 'MANAGER', MANAGER],
  ])('%s may NOT manage %s (target has more access)', (_a, actor, _t, target) => {
    expect(canManageMember(principal('actor', actor), principal('target', target))).toEqual({
      allowed: false,
      reason: 'TARGET_HAS_MORE_ACCESS',
    });
  });
});

describe('canGrantRoles', () => {
  it('lets OWNER grant any system role', () => {
    const roles = SYSTEM_ROLES.map((role) => ({ permissions: role.permissions }));
    expect(canGrantRoles(OWNER, roles).allowed).toBe(true);
  });

  it('stops ADMIN from granting OWNER', () => {
    expect(canGrantRoles(ADMIN, [{ permissions: OWNER }])).toEqual({
      allowed: false,
      reason: 'ROLE_EXCEEDS_YOUR_ACCESS',
    });
  });

  it('rejects a set of roles if any single role exceeds the actor', () => {
    expect(canGrantRoles(ADMIN, [{ permissions: EMPLOYEE }, { permissions: OWNER }]).allowed).toBe(false);
  });

  it('covers custom roles by permission content, not by name', () => {
    const sneaky = { permissions: ['document.read', 'organization.update'] };
    expect(canGrantRoles(ADMIN, [sneaky]).allowed).toBe(false);
    expect(canGrantRoles(OWNER, [sneaky]).allowed).toBe(true);
  });
});
