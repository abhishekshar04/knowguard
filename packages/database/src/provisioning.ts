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
 * Reads permission ids for the code catalog. Fails loudly if the catalog hasn't been
 * synced (the API syncs it on boot; the seed syncs it explicitly).
 */
export async function loadPermissionIds(db: Db): Promise<Map<string, string>> {
  const rows = await db.permission.findMany({
    where: { key: { in: Object.keys(PERMISSIONS) } },
    select: { id: true, key: true },
  });
  const ids = new Map(rows.map((row) => [row.key, row.id]));
  const missing = Object.keys(PERMISSIONS).filter((key) => !ids.has(key));
  if (missing.length > 0) {
    throw new Error(`Permission catalog not synced; missing: ${missing.join(', ')}`);
  }
  return ids;
}

/**
 * Creates (or repairs) the system roles for one organization and grants each role exactly
 * its catalog permissions. Idempotent; must run inside the caller's transaction when
 * creating a new organization so a tenant never exists without its roles.
 * Never writes the global permission catalog, so concurrent signups don't contend on it.
 */
export async function provisionSystemRoles(
  db: Db,
  organizationId: string,
): Promise<Record<SystemRoleKey, string>> {
  const permissionIds = await loadPermissionIds(db);
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
      if (!id) throw new Error(`Permission ${key} missing from catalog`);
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
