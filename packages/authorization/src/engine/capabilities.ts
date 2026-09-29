import type { PermissionKey } from '../permissions';
import type { AuthorizationContext } from './types';

/**
 * Capability check (RBAC only), for operations that are not about one specific resource —
 * e.g. "may this member invite users?". Resource access must go through authorize().
 */
export function hasCapability(context: AuthorizationContext, ...permissions: PermissionKey[]): boolean {
  return context.active && permissions.every((permission) => context.permissions.has(permission));
}
