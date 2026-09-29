/**
 * Local development seed. Idempotent: safe to run repeatedly.
 *
 * Creates one organization with an owner, an admin and an employee, the permission
 * catalog, the system roles, and one department/team for later phases.
 * The demo password comes from SEED_USER_PASSWORD — never hard-coded.
 */
import { hashPassword } from '@knowguard/auth';
import type { SystemRoleKey } from '@knowguard/authorization';

import { createPrismaClient } from '../src/client';
import { provisionSystemRoles } from '../src/provisioning';

const ORGANIZATION = { name: 'Acme Corporation', slug: 'acme' };

const USERS: ReadonlyArray<{ email: string; name: string; role: SystemRoleKey }> = [
  { email: 'owner@acme.example', name: 'Olivia Owner', role: 'OWNER' },
  { email: 'admin@acme.example', name: 'Adam Admin', role: 'ADMIN' },
  { email: 'employee@acme.example', name: 'Emma Employee', role: 'EMPLOYEE' },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the development seed with NODE_ENV=production');
  }
  const password = process.env.SEED_USER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('SEED_USER_PASSWORD must be set (min 12 characters). See .env.example');
  }

  const prisma = createPrismaClient();
  try {
    const passwordHash = await hashPassword(password);

    await prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.upsert({
          where: { slug: ORGANIZATION.slug },
          create: ORGANIZATION,
          update: { name: ORGANIZATION.name },
        });
        const roleIds = await provisionSystemRoles(tx, organization.id);

        for (const seedUser of USERS) {
          const user = await tx.user.upsert({
            where: { email: seedUser.email },
            // Existing users keep their password so re-seeding doesn't clobber local changes.
            create: {
              organizationId: organization.id,
              email: seedUser.email,
              name: seedUser.name,
              passwordHash,
              status: 'ACTIVE',
            },
            update: { name: seedUser.name, status: 'ACTIVE' },
          });
          if (user.organizationId !== organization.id) {
            throw new Error(`Seed user ${seedUser.email} already exists in another organization`);
          }
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId: roleIds[seedUser.role] } },
            create: { organizationId: organization.id, userId: user.id, roleId: roleIds[seedUser.role] },
            update: {},
          });
        }

        const engineering = await tx.department.upsert({
          where: { organizationId_name: { organizationId: organization.id, name: 'Engineering' } },
          create: {
            organizationId: organization.id,
            name: 'Engineering',
            description: 'Product engineering',
          },
          update: {},
        });
        await tx.team.upsert({
          where: { departmentId_name: { departmentId: engineering.id, name: 'Platform' } },
          create: { organizationId: organization.id, departmentId: engineering.id, name: 'Platform' },
          update: {},
        });
      },
      { timeout: 30_000 },
    );

    const counts = {
      organizations: await prisma.organization.count(),
      users: await prisma.user.count(),
      roles: await prisma.role.count(),
      permissions: await prisma.permission.count(),
      rolePermissions: await prisma.rolePermission.count(),
      userRoles: await prisma.userRole.count(),
    };
    // eslint-disable-next-line no-console -- CLI output
    console.log('Seed complete:', counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- CLI output
  console.error(error);
  process.exit(1);
});
