/**
 * Proves tenant isolation is enforced by PostgreSQL itself (composite foreign keys),
 * not only by application code: cross-organization links must be impossible to write.
 */
import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import { createPrismaClient } from '../src/client';
import { provisionSystemRoles } from '../src/provisioning';

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

async function createTenant(label: string): Promise<Tenant> {
  const organization = await prisma.organization.create({
    data: { name: `Tenant ${label}`, slug: `tenant-${label}-${suffix}` },
  });
  const roleIds = await provisionSystemRoles(prisma, organization.id);
  const user = await prisma.user.create({
    data: { organizationId: organization.id, email: `${label}-${suffix}@example.test`, name: label },
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

function expectForeignKeyViolation(error: unknown): void {
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
}

beforeAll(async () => {
  prisma = createPrismaClient({ url });
  orgA = await createTenant('a');
  orgB = await createTenant('b');
});

afterAll(async () => {
  const ids = [orgA?.organizationId, orgB?.organizationId].filter(Boolean) as string[];
  const where = { organizationId: { in: ids } };
  await prisma.userRole.deleteMany({ where });
  await prisma.teamMembership.deleteMany({ where });
  await prisma.departmentMembership.deleteMany({ where });
  await prisma.team.deleteMany({ where });
  await prisma.department.deleteMany({ where });
  await prisma.role.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('same-tenant links are allowed', () => {
  it('assigns a role to a user in the same organization', async () => {
    await expect(
      prisma.userRole.create({
        data: { organizationId: orgA.organizationId, userId: orgA.userId, roleId: orgA.roleIds.EMPLOYEE },
      }),
    ).resolves.toBeDefined();
  });

  it('adds a user to a department and team of the same organization', async () => {
    await prisma.departmentMembership.create({
      data: { organizationId: orgA.organizationId, departmentId: orgA.departmentId, userId: orgA.userId },
    });
    await prisma.teamMembership.create({
      data: { organizationId: orgA.organizationId, teamId: orgA.teamId, userId: orgA.userId },
    });
  });
});

describe('cross-tenant links are rejected by the database', () => {
  it("rejects assigning Org B's role to Org A's user (either organization_id)", async () => {
    for (const organizationId of [orgA.organizationId, orgB.organizationId]) {
      const error = await prisma.userRole
        .create({ data: { organizationId, userId: orgA.userId, roleId: orgB.roleIds.OWNER } })
        .catch((e: unknown) => e);
      expectForeignKeyViolation(error);
    }
  });

  it("rejects adding Org A's user to Org B's department", async () => {
    const error = await prisma.departmentMembership
      .create({
        data: { organizationId: orgB.organizationId, departmentId: orgB.departmentId, userId: orgA.userId },
      })
      .catch((e: unknown) => e);
    expectForeignKeyViolation(error);
  });

  it("rejects adding Org A's user to Org B's team", async () => {
    const error = await prisma.teamMembership
      .create({ data: { organizationId: orgB.organizationId, teamId: orgB.teamId, userId: orgA.userId } })
      .catch((e: unknown) => e);
    expectForeignKeyViolation(error);
  });

  it("rejects creating a team in Org A under Org B's department", async () => {
    const error = await prisma.team
      .create({
        data: { organizationId: orgA.organizationId, departmentId: orgB.departmentId, name: 'Rogue' },
      })
      .catch((e: unknown) => e);
    expectForeignKeyViolation(error);
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
