/**
 * Prisma select fragment + flattener for "the permissions a member holds through their roles".
 * Shared by session authentication (per request) and the management services, so there is
 * exactly one definition of how role grants become a permission set.
 */
export const rolesWithPermissionsSelect = {
  select: {
    role: {
      select: {
        id: true,
        key: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    },
  },
} as const;

interface RoleAssignment {
  role: { id: string; key: string; permissions: ReadonlyArray<{ permission: { key: string } }> };
}

export function permissionsOf(assignments: ReadonlyArray<RoleAssignment>): Set<string> {
  return new Set(assignments.flatMap((a) => a.role.permissions.map((grant) => grant.permission.key)));
}

export function roleKeysOf(assignments: ReadonlyArray<RoleAssignment>): string[] {
  return assignments.map((a) => a.role.key).sort();
}

export function roleIdsOf(assignments: ReadonlyArray<RoleAssignment>): Set<string> {
  return new Set(assignments.map((a) => a.role.id));
}
