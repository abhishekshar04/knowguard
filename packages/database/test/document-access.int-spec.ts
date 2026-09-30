/**
 * EQUIVALENCE: the SQL filter (readableDocumentsWhere) must return exactly the documents the
 * authorization engine allows (authorize(context, 'READ', doc).allowed) — for randomized
 * documents, ACLs, audiences and callers, across two tenants. Any divergence is a potential
 * data leak (filter too wide) or broken access (filter too narrow).
 */
import { randomUUID } from 'node:crypto';

import {
  type AclEntry,
  authorize,
  type AuthorizationContext,
  PERMISSION_KEYS,
  RESOURCE_ACTIONS,
  SUBJECT_TYPES,
  VISIBILITIES,
} from '@knowguard/authorization';
import { type PrismaClient } from '@prisma/client';
import fc from 'fast-check';

import { createPrismaClient } from '../src/client';
import { protectedDocumentSelect, readableDocumentsWhere, toProtectedResource } from '../src/document-access';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL must be set for integration tests');

let prisma: PrismaClient;
const suffix = randomUUID().slice(0, 8);

/** Small ID pools so subjects, audiences and ACL entries collide often. */
const ROLE_IDS = [randomUUID(), randomUUID()];
const TEAM_IDS = [randomUUID(), randomUUID()];
const DEPT_IDS = [randomUUID(), randomUUID()];
let orgs: Array<{ id: string; userIds: string[] }> = [];

async function createOrg(label: string) {
  const org = await prisma.organization.create({ data: { name: label, slug: `acl-${label}-${suffix}` } });
  const userIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const user = await prisma.user.create({
      data: {
        email: `acl-${label}-${i}-${suffix}@example.test`,
        name: `${label}-${i}`,
        status: 'ACTIVE',
        memberships: { create: { organizationId: org.id, status: 'ACTIVE' } },
      },
    });
    userIds.push(user.id);
  }
  return { id: org.id, userIds };
}

beforeAll(async () => {
  prisma = createPrismaClient({ url });
  orgs = [await createOrg('one'), await createOrg('two')];
});

afterAll(async () => {
  const orgIds = orgs.map((o) => o.id);
  await prisma.document.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: orgs.flatMap((o) => o.userIds) } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.$disconnect();
});

// ── generators ──────────────────────────────────────────────────────────────────────────

const orgIndex = fc.constantFrom(0, 1);
const userIndex = fc.constantFrom(0, 1, 2);
const pool = (ids: string[]) => fc.constantFrom(...ids);
const subset = (ids: string[]) => fc.subarray(ids).map((xs) => new Set(xs));

const aclEntry = fc
  .record({
    subjectType: fc.constantFrom(...SUBJECT_TYPES),
    userIndex,
    role: pool(ROLE_IDS),
    team: pool(TEAM_IDS),
    dept: pool(DEPT_IDS),
    action: fc.constantFrom(...RESOURCE_ACTIONS),
    effect: fc.constantFrom('ALLOW' as const, 'DENY' as const),
  })
  .map((e) => ({ ...e }));

const documentSpec = fc.record({
  orgIndex,
  ownerIndex: userIndex,
  visibility: fc.constantFrom(...VISIBILITIES),
  audience: fc.subarray([...ROLE_IDS, ...TEAM_IDS, ...DEPT_IDS], { maxLength: 3 }),
  acl: fc.array(aclEntry, { maxLength: 4 }),
});

const contextSpec = fc.record({
  orgIndex,
  userIndex,
  active: fc.boolean(),
  permissions: fc.oneof(
    fc.constant(new Set<string>(PERMISSION_KEYS)),
    fc.subarray([...PERMISSION_KEYS]).map((keys) => new Set<string>(keys)),
  ),
  roleIds: subset(ROLE_IDS),
  teamIds: subset(TEAM_IDS),
  departmentIds: subset(DEPT_IDS),
});

// ── property ────────────────────────────────────────────────────────────────────────────

describe('readableDocumentsWhere ≡ authorize(context, READ, document)', () => {
  it('returns exactly the documents the engine allows', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(documentSpec, { minLength: 1, maxLength: 12 }),
        fc.array(contextSpec, { minLength: 1, maxLength: 4 }),
        async (documentSpecs, contextSpecs) => {
          const created: string[] = [];
          try {
            for (const spec of documentSpecs) {
              const org = orgs[spec.orgIndex]!;
              const entries = new Map<string, AclEntry>();
              for (const e of spec.acl) {
                const subjectId =
                  e.subjectType === 'USER'
                    ? org.userIds[e.userIndex]!
                    : e.subjectType === 'ROLE'
                      ? e.role
                      : e.subjectType === 'TEAM'
                        ? e.team
                        : e.dept;
                // One entry per (subject, action) — mirrors the unique constraint.
                entries.set(`${e.subjectType}:${subjectId}:${e.action}`, {
                  subjectType: e.subjectType,
                  subjectId,
                  action: e.action,
                  effect: e.effect,
                });
              }
              const doc = await prisma.document.create({
                data: {
                  organizationId: org.id,
                  ownerId: org.userIds[spec.ownerIndex]!,
                  title: 'property',
                  visibility: spec.visibility,
                  status: 'READY',
                  mimeType: 'text/plain',
                  size: 1,
                  storageKey: 'n/a',
                  audience: {
                    create: spec.audience.map((targetId) => ({ targetId })), // organizationId inherited via composite FK
                  },
                  permissions: {
                    create: [...entries.values()].map((e) => ({
                      subjectType: e.subjectType,
                      subjectId: e.subjectId,
                      permission: e.action,
                      effect: e.effect,
                    })),
                  },
                },
                select: { id: true },
              });
              created.push(doc.id);
            }

            const rows = await prisma.document.findMany({
              where: { id: { in: created } },
              select: { id: true, ...protectedDocumentSelect },
            });

            for (const spec of contextSpecs) {
              const org = orgs[spec.orgIndex]!;
              const context: AuthorizationContext = {
                userId: org.userIds[spec.userIndex]!,
                organizationId: org.id,
                active: spec.active,
                permissions: spec.permissions,
                roleIds: spec.roleIds,
                teamIds: spec.teamIds,
                departmentIds: spec.departmentIds,
              };
              const expected = rows
                .filter((row) => authorize(context, 'READ', toProtectedResource(row)).allowed)
                .map((row) => row.id)
                .sort();
              const actual = (
                await prisma.document.findMany({
                  where: { AND: [{ id: { in: created } }, readableDocumentsWhere(context)] },
                  select: { id: true },
                })
              )
                .map((row) => row.id)
                .sort();
              expect(actual).toEqual(expected);
            }
          } finally {
            await prisma.document.deleteMany({ where: { id: { in: created } } });
          }
        },
      ),
      { numRuns: 60 },
    );
  }, 180_000);
});
