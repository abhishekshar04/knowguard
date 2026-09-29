import type { PermissionKey } from '../permissions';

/**
 * Everything the engine may know about the caller. Built server-side from the session —
 * never from client input. All sets are scoped to `organizationId`.
 */
export interface AuthorizationContext {
  userId: string;
  organizationId: string;
  /** Account AND membership are ACTIVE. Anything else is denied outright. */
  active: boolean;
  /** Capabilities granted through roles (e.g. "document.read"). */
  permissions: ReadonlySet<string>;
  roleIds: ReadonlySet<string>;
  teamIds: ReadonlySet<string>;
  departmentIds: ReadonlySet<string>;
}

/** Actions on a single resource. They map to capabilities: READ → "document.read", etc. */
export const RESOURCE_ACTIONS = ['READ', 'WRITE', 'DELETE', 'SHARE'] as const;
export type ResourceAction = (typeof RESOURCE_ACTIONS)[number];

/**
 * Who inherits READ access without an explicit entry (spec §12):
 *  - PRIVATE:      only the owner. ACL allows are ignored (sharing is effectively off).
 *  - CUSTOM:       nobody inherits; access comes only from explicit ACL entries.
 *  - ROLE / TEAM / DEPARTMENT: members holding one of `audienceIds` roles/teams/departments.
 *  - ORGANIZATION: every active member.
 */
export const VISIBILITIES = ['PRIVATE', 'CUSTOM', 'ROLE', 'TEAM', 'DEPARTMENT', 'ORGANIZATION'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const SUBJECT_TYPES = ['USER', 'ROLE', 'TEAM', 'DEPARTMENT'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export type Effect = 'ALLOW' | 'DENY';

/** One access-control entry on a resource (spec §13, plus an explicit DENY effect). */
export interface AclEntry {
  subjectType: SubjectType;
  subjectId: string;
  action: ResourceAction;
  effect: Effect;
}

/** The authorization-relevant shape of a protected resource (a document from Phase 5 on). */
export interface ProtectedResource {
  organizationId: string;
  ownerId: string;
  visibility: Visibility;
  /** Role, team or department IDs for ROLE / TEAM / DEPARTMENT visibility; ignored otherwise. */
  audienceIds: readonly string[];
  acl: readonly AclEntry[];
}

export type DecisionReason =
  // Denials, in evaluation order
  | 'TENANT_MISMATCH'
  | 'INACTIVE_PRINCIPAL'
  | 'MISSING_CAPABILITY'
  | 'EXPLICIT_DENY'
  | 'DEFAULT_DENY'
  // Grants
  | 'OWNER'
  | 'EXPLICIT_ALLOW'
  | 'INHERITED_ALLOW';

export interface Decision {
  allowed: boolean;
  reason: DecisionReason;
  /** The ACL entry that decided an EXPLICIT_* outcome (for auditing). */
  entry?: AclEntry;
  /** The visibility that granted an INHERITED_ALLOW (for auditing). */
  visibility?: Visibility;
}

/** Capability each resource action requires, from the role-permission catalog. */
export const ACTION_CAPABILITY: Record<ResourceAction, PermissionKey> = {
  READ: 'document.read',
  WRITE: 'document.update',
  DELETE: 'document.delete',
  SHARE: 'document.share',
};
