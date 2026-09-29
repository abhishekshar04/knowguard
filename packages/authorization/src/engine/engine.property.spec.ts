/**
 * Property-based tests: the engine's security invariants must hold for ANY combination of
 * caller and resource, not just the hand-picked scenarios. IDs come from tiny pools so that
 * subjects, audiences and ACL entries collide often.
 */
import fc from 'fast-check';

import { PERMISSION_KEYS } from '../permissions';
import { authorize } from './engine';
import {
  ACTION_CAPABILITY,
  type AclEntry,
  type AuthorizationContext,
  type ProtectedResource,
  RESOURCE_ACTIONS,
  SUBJECT_TYPES,
  VISIBILITIES,
} from './types';

const RUNS = { numRuns: 2_000 };

const id = fc.constantFrom('a', 'b', 'c');
const ids = fc.uniqueArray(id, { maxLength: 3 });
const org = fc.constantFrom('org-1', 'org-2');
const action = fc.constantFrom(...RESOURCE_ACTIONS);

const context: fc.Arbitrary<AuthorizationContext> = fc.record({
  userId: id,
  organizationId: org,
  active: fc.boolean(),
  permissions: fc.subarray([...PERMISSION_KEYS]).map((keys) => new Set<string>(keys)),
  roleIds: ids.map((xs) => new Set(xs)),
  teamIds: ids.map((xs) => new Set(xs)),
  departmentIds: ids.map((xs) => new Set(xs)),
});

const entry: fc.Arbitrary<AclEntry> = fc.record({
  subjectType: fc.constantFrom(...SUBJECT_TYPES),
  subjectId: id,
  action,
  effect: fc.constantFrom('ALLOW' as const, 'DENY' as const),
});

const resource: fc.Arbitrary<ProtectedResource> = fc.record({
  organizationId: org,
  ownerId: id,
  visibility: fc.constantFrom(...VISIBILITIES),
  audienceIds: fc.array(id, { maxLength: 3 }),
  acl: fc.array(entry, { maxLength: 6 }),
});

function matches(c: AuthorizationContext, e: AclEntry): boolean {
  if (e.subjectType === 'USER') return e.subjectId === c.userId;
  if (e.subjectType === 'ROLE') return c.roleIds.has(e.subjectId);
  if (e.subjectType === 'TEAM') return c.teamIds.has(e.subjectId);
  return c.departmentIds.has(e.subjectId);
}

describe('authorization engine invariants', () => {
  it('never allows across tenants', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        if (c.organizationId !== r.organizationId) expect(authorize(c, a, r).allowed).toBe(false);
      }),
      RUNS,
    );
  });

  it('never allows an inactive principal', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        if (!c.active) expect(authorize(c, a, r).allowed).toBe(false);
      }),
      RUNS,
    );
  });

  it('never allows without the role capability for the action', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        if (!c.permissions.has(ACTION_CAPABILITY[a])) expect(authorize(c, a, r).allowed).toBe(false);
      }),
      RUNS,
    );
  });

  it('an applicable explicit DENY always wins (over ownership, allows and visibility)', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        const denied = r.acl.some(
          (e) => e.effect === 'DENY' && matches(c, e) && (e.action === a || e.action === 'READ'),
        );
        if (denied) expect(authorize(c, a, r).allowed).toBe(false);
      }),
      RUNS,
    );
  });

  it('PRIVATE resources are only ever accessible to their owner', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        if (r.visibility === 'PRIVATE' && r.ownerId !== c.userId)
          expect(authorize(c, a, r).allowed).toBe(false);
      }),
      RUNS,
    );
  });

  it('visibility never grants anything except READ', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        const decision = authorize(c, a, r);
        if (decision.reason === 'INHERITED_ALLOW') expect(a).toBe('READ');
      }),
      RUNS,
    );
  });

  it('adding a DENY entry can never turn a denial into a grant (monotonic)', () => {
    fc.assert(
      fc.property(context, action, resource, entry, (c, a, r, extra) => {
        const before = authorize(c, a, r).allowed;
        const after = authorize(c, a, { ...r, acl: [...r.acl, { ...extra, effect: 'DENY' }] }).allowed;
        if (!before) expect(after).toBe(false);
      }),
      RUNS,
    );
  });

  it('removing a capability can never turn a denial into a grant (monotonic)', () => {
    fc.assert(
      fc.property(context, action, resource, fc.constantFrom(...PERMISSION_KEYS), (c, a, r, removed) => {
        const fewer = new Set([...c.permissions].filter((p) => p !== removed));
        if (!authorize(c, a, r).allowed)
          expect(authorize({ ...c, permissions: fewer }, a, r).allowed).toBe(false);
      }),
      RUNS,
    );
  });

  it('the outcome does not depend on ACL entry order', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        const reversed = { ...r, acl: [...r.acl].reverse() };
        expect(authorize(c, a, reversed).allowed).toBe(authorize(c, a, r).allowed);
      }),
      RUNS,
    );
  });

  it('every grant is explained by ownership, a matching ALLOW entry, or visibility', () => {
    fc.assert(
      fc.property(context, action, resource, (c, a, r) => {
        const decision = authorize(c, a, r);
        if (!decision.allowed) return;
        if (decision.reason === 'OWNER') expect(r.ownerId).toBe(c.userId);
        if (decision.reason === 'EXPLICIT_ALLOW') {
          expect(decision.entry?.effect).toBe('ALLOW');
          expect(matches(c, decision.entry!)).toBe(true);
        }
        if (decision.reason === 'INHERITED_ALLOW') expect(r.visibility).not.toMatch(/^(PRIVATE|CUSTOM)$/);
      }),
      RUNS,
    );
  });
});
