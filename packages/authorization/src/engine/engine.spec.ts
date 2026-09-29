import { PERMISSION_KEYS } from '../permissions';
import { SYSTEM_ROLES } from '../system-roles';
import { authorize } from './engine';
import type { AclEntry, AuthorizationContext, ProtectedResource } from './types';

const ORG = 'org-a';
const EMPLOYEE_PERMISSIONS = new Set(SYSTEM_ROLES.find((r) => r.key === 'EMPLOYEE')!.permissions);
const ALL_PERMISSIONS = new Set<string>(PERMISSION_KEYS);

function ctx(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    userId: 'alice',
    organizationId: ORG,
    active: true,
    permissions: ALL_PERMISSIONS,
    roleIds: new Set(['role-employee']),
    teamIds: new Set(['team-platform']),
    departmentIds: new Set(['dept-eng']),
    ...overrides,
  };
}

function doc(overrides: Partial<ProtectedResource> = {}): ProtectedResource {
  return {
    organizationId: ORG,
    ownerId: 'bob',
    visibility: 'CUSTOM',
    audienceIds: [],
    acl: [],
    ...overrides,
  };
}

const allow = (
  subjectType: AclEntry['subjectType'],
  subjectId: string,
  action: AclEntry['action'] = 'READ',
): AclEntry => ({
  subjectType,
  subjectId,
  action,
  effect: 'ALLOW',
});
const deny = (
  subjectType: AclEntry['subjectType'],
  subjectId: string,
  action: AclEntry['action'] = 'READ',
): AclEntry => ({
  subjectType,
  subjectId,
  action,
  effect: 'DENY',
});

describe('authorize — specification scenarios (§33)', () => {
  it('same organization + allowed role: organization-visible document is readable', () => {
    expect(
      authorize(ctx({ permissions: EMPLOYEE_PERMISSIONS }), 'READ', doc({ visibility: 'ORGANIZATION' })),
    ).toEqual({
      allowed: true,
      reason: 'INHERITED_ALLOW',
      visibility: 'ORGANIZATION',
    });
  });

  it('same organization + role lacking the capability: denied even for an organization-wide document', () => {
    const noRead = new Set([...ALL_PERMISSIONS].filter((p) => p !== 'document.read'));
    expect(authorize(ctx({ permissions: noRead }), 'READ', doc({ visibility: 'ORGANIZATION' })).reason).toBe(
      'MISSING_CAPABILITY',
    );
  });

  it('explicit document permission grants access to a CUSTOM document', () => {
    const decision = authorize(ctx(), 'READ', doc({ acl: [allow('USER', 'alice')] }));
    expect(decision).toMatchObject({ allowed: true, reason: 'EXPLICIT_ALLOW' });
  });

  it('explicit deny overrides organization-wide visibility', () => {
    const decision = authorize(
      ctx(),
      'READ',
      doc({ visibility: 'ORGANIZATION', acl: [deny('TEAM', 'team-platform')] }),
    );
    expect(decision).toMatchObject({ allowed: false, reason: 'EXPLICIT_DENY' });
  });

  it('department access', () => {
    const resource = doc({ visibility: 'DEPARTMENT', audienceIds: ['dept-eng'] });
    expect(authorize(ctx(), 'READ', resource).allowed).toBe(true);
    expect(authorize(ctx({ departmentIds: new Set(['dept-sales']) }), 'READ', resource).reason).toBe(
      'DEFAULT_DENY',
    );
  });

  it('team access', () => {
    const resource = doc({ visibility: 'TEAM', audienceIds: ['team-platform'] });
    expect(authorize(ctx(), 'READ', resource).allowed).toBe(true);
    expect(authorize(ctx({ teamIds: new Set() }), 'READ', resource).reason).toBe('DEFAULT_DENY');
  });

  it('role access', () => {
    const resource = doc({ visibility: 'ROLE', audienceIds: ['role-manager'] });
    expect(authorize(ctx(), 'READ', resource).reason).toBe('DEFAULT_DENY');
    expect(authorize(ctx({ roleIds: new Set(['role-manager']) }), 'READ', resource).allowed).toBe(true);
  });

  it('cross-organization access is denied — even for the owner with explicit allows', () => {
    const foreign = doc({
      organizationId: 'org-b',
      ownerId: 'alice',
      visibility: 'ORGANIZATION',
      acl: [allow('USER', 'alice', 'SHARE')],
    });
    for (const action of ['READ', 'WRITE', 'DELETE', 'SHARE'] as const) {
      expect(authorize(ctx(), action, foreign).reason).toBe('TENANT_MISMATCH');
    }
  });

  it('suspended/deactivated principals are denied everything, even their own documents', () => {
    const own = doc({ ownerId: 'alice', visibility: 'ORGANIZATION' });
    expect(authorize(ctx({ active: false }), 'READ', own).reason).toBe('INACTIVE_PRINCIPAL');
  });
});

describe('authorize — ownership, visibility and action semantics', () => {
  it('owners may do everything their capabilities allow', () => {
    for (const action of ['READ', 'WRITE', 'DELETE', 'SHARE'] as const) {
      expect(authorize(ctx(), action, doc({ ownerId: 'alice', visibility: 'PRIVATE' }))).toEqual({
        allowed: true,
        reason: 'OWNER',
      });
    }
  });

  it('ownership does not exceed role capabilities', () => {
    expect(
      authorize(ctx({ permissions: EMPLOYEE_PERMISSIONS }), 'DELETE', doc({ ownerId: 'alice' })).reason,
    ).toBe('MISSING_CAPABILITY');
  });

  it('an explicit DENY beats ownership (e.g. an admin revoking an owner)', () => {
    const resource = doc({ ownerId: 'alice', acl: [deny('USER', 'alice')] });
    expect(authorize(ctx(), 'READ', resource).reason).toBe('EXPLICIT_DENY');
  });

  it('PRIVATE ignores explicit allows: owner only', () => {
    const resource = doc({ visibility: 'PRIVATE', acl: [allow('USER', 'alice', 'WRITE')] });
    expect(authorize(ctx(), 'READ', resource).reason).toBe('DEFAULT_DENY');
    expect(authorize(ctx(), 'WRITE', resource).reason).toBe('DEFAULT_DENY');
  });

  it('visibility only ever grants READ', () => {
    const resource = doc({ visibility: 'ORGANIZATION' });
    for (const action of ['WRITE', 'DELETE', 'SHARE'] as const) {
      expect(authorize(ctx(), action, resource).reason).toBe('DEFAULT_DENY');
    }
  });

  it('an ALLOW for WRITE/DELETE/SHARE implies READ, but not the other way round', () => {
    expect(authorize(ctx(), 'READ', doc({ acl: [allow('TEAM', 'team-platform', 'WRITE')] })).allowed).toBe(
      true,
    );
    expect(authorize(ctx(), 'WRITE', doc({ acl: [allow('TEAM', 'team-platform', 'READ')] })).allowed).toBe(
      false,
    );
    expect(authorize(ctx(), 'DELETE', doc({ acl: [allow('TEAM', 'team-platform', 'WRITE')] })).allowed).toBe(
      false,
    );
  });

  it('a DENY for READ blocks every action; a DENY for WRITE leaves READ intact', () => {
    const noRead = doc({
      visibility: 'ORGANIZATION',
      acl: [allow('USER', 'alice', 'WRITE'), deny('ROLE', 'role-employee')],
    });
    expect(authorize(ctx(), 'WRITE', noRead).reason).toBe('EXPLICIT_DENY');
    const noWrite = doc({ visibility: 'ORGANIZATION', acl: [deny('USER', 'alice', 'WRITE')] });
    expect(authorize(ctx(), 'READ', noWrite).allowed).toBe(true);
    expect(authorize(ctx(), 'WRITE', noWrite).reason).toBe('EXPLICIT_DENY');
  });

  it('entries for other subjects are ignored', () => {
    const resource = doc({
      acl: [allow('USER', 'carol'), allow('TEAM', 'team-other'), deny('DEPARTMENT', 'dept-sales')],
    });
    expect(authorize(ctx(), 'READ', resource).reason).toBe('DEFAULT_DENY');
  });

  it('matches every subject type', () => {
    expect(authorize(ctx(), 'READ', doc({ acl: [allow('ROLE', 'role-employee')] })).allowed).toBe(true);
    expect(authorize(ctx(), 'READ', doc({ acl: [allow('DEPARTMENT', 'dept-eng')] })).allowed).toBe(true);
  });

  it('reports the deciding entry for auditing', () => {
    const entry = deny('DEPARTMENT', 'dept-eng');
    expect(authorize(ctx(), 'READ', doc({ visibility: 'ORGANIZATION', acl: [entry] })).entry).toEqual(entry);
  });

  it('defaults to deny with no ACL and CUSTOM visibility', () => {
    expect(authorize(ctx(), 'READ', doc()).reason).toBe('DEFAULT_DENY');
  });
});
