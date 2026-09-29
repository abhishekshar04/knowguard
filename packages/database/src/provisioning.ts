import { PERMISSIONS, SYSTEM_ROLES, type SystemRoleKey } from '@knowguard/authorization';
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Makes the `permissions` table match the code catalog. Idempotent.
 * Permissions removed from the catalog are left in place (and flagged by a failing
 * catalog test) rather than deleted, so a bad deploy cannot silently strip role grants.
 */
export async function syncPermissionCatalog(db: Db): Promise<Map<string, string>> {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await db.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }
  const rows = await db.permission.findMany({ select: { id: true, key: true } });
  return new Map(rows.map((row) => [row.key, row.id]));
}

/**
 * Creates (or repairs) the system roles for one organization and grants each role exactly
 * its catalog permissions. Idempotent; must run inside the caller's transaction when
 * creating a new organization so a tenant never exists without its roles.
 */
export async function provisionSystemRoles(
  db: Db,
  organizationId: string,
): Promise<Record<SystemRoleKey, string>> {
  const permissionIds = await syncPermissionCatalog(db);
  const roleIds = {} as Record<SystemRoleKey, string>;

  for (const definition of SYSTEM_ROLES) {
    const role = await db.role.upsert({
      where: { organizationId_key: { organizationId, key: definition.key } },
      create: {
        organizationId,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
      update: { name: definition.name, description: definition.description, isSystem: true },
    });
    roleIds[definition.key] = role.id;

    const wanted = definition.permissions.map((key) => {
      const id = permissionIds.get(key);
      if (!id) throw new Error(`Permission ${key} missing after catalog sync`);
      return id;
    });
    await db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: wanted } } });
    await db.rolePermission.createMany({
      data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  return roleIds;
}
