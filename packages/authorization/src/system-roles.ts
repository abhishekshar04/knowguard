import { PERMISSION_KEYS, type PermissionKey } from './permissions';

export const SYSTEM_ROLE_KEYS = ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export interface SystemRoleDefinition {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}

/**
 * Default roles provisioned into every new organization. They are ordinary, per-tenant
 * Role rows (flagged isSystem) so custom roles use exactly the same code path.
 *
 * Role permissions are capability gates. Document-level ACLs (Phase 4/5) further restrict
 * which documents `document.*` applies to — holding `document.read` does not grant
 * access to every document.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    key: 'OWNER',
    name: 'Owner',
    description: 'Full control of the organization.',
    permissions: PERMISSION_KEYS,
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    description: 'Administers users, roles and documents. Cannot change organization settings.',
    permissions: PERMISSION_KEYS.filter((key) => key !== 'organization.update'),
  },
  {
    key: 'MANAGER',
    name: 'Manager',
    description: 'Manages and shares documents for their teams.',
    permissions: [
      'organization.read',
      'user.read',
      'role.read',
      'document.read',
      'document.create',
      'document.update',
      'document.share',
      'ai.query',
    ],
  },
  {
    key: 'EMPLOYEE',
    name: 'Employee',
    description: 'Reads and contributes documents they are granted access to.',
    permissions: ['organization.read', 'user.read', 'document.read', 'document.create', 'ai.query'],
  },
];
