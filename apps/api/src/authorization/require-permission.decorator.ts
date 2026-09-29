import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@knowguard/authorization';

export const REQUIRED_PERMISSIONS_KEY = 'knowguard:requiredPermissions';

/**
 * Requires the caller to hold ALL listed permissions in their current organization
 * (checked by SessionAuthGuard after authentication, 403 otherwise). This is the capability
 * gate; services still apply resource-level rules (e.g. no privilege escalation).
 * Phase 4 extends evaluation (ACLs, explicit denies) behind this same decorator.
 */
export const RequirePermission = (...permissions: [PermissionKey, ...PermissionKey[]]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
