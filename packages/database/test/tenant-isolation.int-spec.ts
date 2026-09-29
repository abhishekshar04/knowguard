/**
 * Proves tenant isolation is enforced by PostgreSQL itself (composite foreign keys),
 * not only by application code: cross-organization links must be impossible to write.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import { createPrismaClient } from '../src/client';
import { provisionSystemRoles, syncPermissionCatalog } from '../src/provisioning';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL must be set for integration tests');

let prisma: PrismaClient;
const suffix = randomUUID().slice(0, 8);

interface Tenant {
  organizationId: string;
  userId: string;
  roleIds: Awaited<ReturnType<typeof provisionSystemRoles>>;
  departmentId: string;
  teamId: string;
}
let orgA: Tenant;
let orgB: Tenant;
const extraUserIds: string[] = [];

async function createTenant(label: string): Promise<Tenant> {
  const organization = await prisma.organization.create({
    data: { name: `Tenant ${label}`, slug: `tenant-${label}-${suffix}` },
  });
  const roleIds = await provisionSystemRoles(prisma, organization.id);
  const user = await prisma.user.create({
    data: {
      email: `${label}-${suffix}@example.test`,
      name: label,
      memberships: { create: { organizationId: organization.id } },
    },
  });
  const department = await prisma.department.create({
    data: { organizationId: organization.id, name: 'Engineering' },
  });
  const team = await prisma.team.create({
    data: { organizationId: organization.id, departmentId: department.id, name: 'Platform' },
  });
  return {
    organizationId: organization.id,
    userId: user.id,
    roleIds,
    departmentId: department.id,
    teamId: team.id,
  };
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

function expectPrismaError(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(code);
}
const FOREIGN_KEY_VIOLATION = 'P2003';
const UNIQUE_VIOLATION = 'P2002';

const sessionData = (userId: string, organizationId: string) => ({
  userId,
  organizationId,
  tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
  expiresAt: new Date(Date.now() + 60_000),
});

beforeAll(async () => {
  prisma = createPrismaClient({ url });
  await syncPermissionCatalog(prisma);
  orgA = await createTenant('a');
  orgB = await createTenant('b');
});

afterAll(async () => {
  const orgIds = [orgA?.organizationId, orgB?.organizationId].filter(Boolean) as string[];
  const userIds = [orgA?.userId, orgB?.userId, ...extraUserIds].filter(Boolean) as string[];
  // Deleting users cascades memberships, sessions, role assignments and group memberships.
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const where = { organizationId: { in: orgIds } };
  await prisma.team.deleteMany({ where });
  await prisma.department.deleteMany({ where });
  await prisma.role.deleteMany({ where });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.$disconnect();
});

describe('same-tenant links are allowed', () => {
  it('assigns a role to a member of the same organization', async () => {
    await expect(
      prisma.userRole.create({
        data: { organizationId: orgA.organizationId, userId: orgA.userId, roleId: orgA.roleIds.EMPLOYEE },
      }),
    ).resolves.toBeDefined();
  });

  it('adds a member to a department and team of the same organization', async () => {
    await prisma.departmentMembership.create({
      data: { organizationId: orgA.organizationId, departmentId: orgA.departmentId, userId: orgA.userId },
    });
    await prisma.teamMembership.create({
      data: { organizationId: orgA.organizationId, teamId: orgA.teamId, userId: orgA.userId },
    });
  });

  it('creates a session bound to an existing membership', async () => {
    await expect(
      prisma.session.create({ data: sessionData(orgA.userId, orgA.organizationId) }),
    ).resolves.toBeDefined();
  });
});

describe('cross-tenant links are rejected by the database', () => {
  it("rejects assigning Org B's role to Org A's user (either organization_id)", async () => {
    for (const organizationId of [orgA.organizationId, orgB.organizationId]) {
      const error = await errorOf(
        prisma.userRole.create({ data: { organizationId, userId: orgA.userId, roleId: orgB.roleIds.OWNER } }),
      );
      expectPrismaError(error, FOREIGN_KEY_VIOLATION);
    }
  });

  it("rejects adding Org A's user to Org B's department", async () => {
    const error = await errorOf(
      prisma.departmentMembership.create({
        data: { organizationId: orgB.organizationId, departmentId: orgB.departmentId, userId: orgA.userId },
      }),
    );
    expectPrismaError(error, FOREIGN_KEY_VIOLATION);
  });

  it("rejects adding Org A's user to Org B's team", async () => {
    const error = await errorOf(
      prisma.teamMembership.create({
        data: { organizationId: orgB.organizationId, teamId: orgB.teamId, userId: orgA.userId },
      }),
    );
    expectPrismaError(error, FOREIGN_KEY_VIOLATION);
  });

  it("rejects creating a team in Org A under Org B's department", async () => {
    const error = await errorOf(
      prisma.team.create({
        data: { organizationId: orgA.organizationId, departmentId: orgB.departmentId, name: 'Rogue' },
      }),
    );
    expectPrismaError(error, FOREIGN_KEY_VIOLATION);
  });

  it("rejects a session for Org A's user scoped to Org B (no membership)", async () => {
    const error = await errorOf(
      prisma.session.create({ data: sessionData(orgA.userId, orgB.organizationId) }),
    );
    expectPrismaError(error, FOREIGN_KEY_VIOLATION);
  });

  it('rejects role assignment for a user with no membership at all', async () => {
    const loner = await prisma.user.create({
      data: { email: `loner-${suffix}@example.test`, name: 'Loner' },
    });
    extraUserIds.push(loner.id);
    const error = await errorOf(
      prisma.userRole.create({
        data: { organizationId: orgA.organizationId, userId: loner.id, roleId: orgA.roleIds.EMPLOYEE },
      }),
    );
    expectPrismaError(error, FOREIGN_KEY_VIOLATION);
  });
});

describe('membership model', () => {
  it('enforces one organization per user (MVP constraint)', async () => {
    const error = await errorOf(
      prisma.userOrganization.create({ data: { userId: orgA.userId, organizationId: orgB.organizationId } }),
    );
    expectPrismaError(error, UNIQUE_VIOLATION);
  });

  it('removes role assignments and sessions when a membership is removed', async () => {
    const tenant = await createTenant(`c`);
    extraUserIds.push(tenant.userId);
    await prisma.userRole.create({
      data: { organizationId: tenant.organizationId, userId: tenant.userId, roleId: tenant.roleIds.OWNER },
    });
    await prisma.session.create({ data: sessionData(tenant.userId, tenant.organizationId) });

    await prisma.userOrganization.delete({
      where: { userId_organizationId: { userId: tenant.userId, organizationId: tenant.organizationId } },
    });

    expect(await prisma.userRole.count({ where: { userId: tenant.userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: tenant.userId } })).toBe(0);

    await prisma.team.deleteMany({ where: { organizationId: tenant.organizationId } });
    await prisma.department.deleteMany({ where: { organizationId: tenant.organizationId } });
    await prisma.role.deleteMany({ where: { organizationId: tenant.organizationId } });
    await prisma.organization.delete({ where: { id: tenant.organizationId } });
  });
});

describe('system role provisioning', () => {
  it('gives each organization its own isolated role rows', () => {
    expect(orgA.roleIds.OWNER).not.toBe(orgB.roleIds.OWNER);
  });

  it('is idempotent', async () => {
    const before = await prisma.rolePermission.count({
      where: { role: { organizationId: orgA.organizationId } },
    });
    const again = await provisionSystemRoles(prisma, orgA.organizationId);
    const after = await prisma.rolePermission.count({
      where: { role: { organizationId: orgA.organizationId } },
    });
    expect(again).toEqual(orgA.roleIds);
    expect(after).toBe(before);
  });

  it('grants EMPLOYEE no user-administration permissions', async () => {
    const granted = await prisma.rolePermission.findMany({
      where: { roleId: orgA.roleIds.EMPLOYEE },
      select: { permission: { select: { key: true } } },
    });
    const keys = granted.map((row) => row.permission.key);
    expect(keys).toContain('document.read');
    expect(keys).not.toContain('user.create');
    expect(keys).not.toContain('role.update');
  });
});
