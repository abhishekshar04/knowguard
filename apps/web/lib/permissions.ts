import type { MeResponse } from '@knowguard/types';

/**
 * UI hint only: decides what to SHOW. Every action is authorized again by the API, so a user
 * who forges a request for a hidden control still gets 403.
 */
export function can(me: Pick<MeResponse, 'permissions'>, ...permissions: string[]): boolean {
  return permissions.every((permission) => me.permissions.includes(permission));
}
