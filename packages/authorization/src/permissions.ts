/**
 * Canonical permission catalog. The database `permissions` table is seeded from this
 * list; business logic references these keys, never role names.
 */
export const PERMISSIONS = {
  'organization.read': 'View organization details',
  'organization.update': 'Change organization settings',

  'user.read': 'View users in the organization',
  'user.create': 'Create and invite users',
  'user.update': 'Update users, including suspension',
  'user.delete': 'Delete users',

  'role.read': 'View roles and their permissions',
  'role.create': 'Create custom roles',
  'role.update': 'Change role permissions and assignments',
  'role.delete': 'Delete custom roles',

  'document.read': 'Read documents the user is granted access to',
  'document.create': 'Upload documents',
  'document.update': 'Update documents the user is granted write access to',
  'document.delete': 'Delete documents the user is granted delete access to',
  'document.share': 'Change document permissions the user is granted share access to',

  'audit.read': 'Review audit logs',

  'ai.query': 'Ask the AI assistant about authorized knowledge',
} as const satisfies Record<string, string>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}
