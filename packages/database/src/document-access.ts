import type { AclEntry, AuthorizationContext, ProtectedResource } from '@knowguard/authorization';
import type { Prisma } from '@prisma/client';

/**
 * Query-level twin of authorize(context, 'READ', document) from @knowguard/authorization.
 *
 * The engine is the specification; this filter is the optimization used for listing, search
 * and (later) retrieval, where evaluating documents one by one is impossible. The two MUST
 * agree exactly — test/document-access.int-spec.ts checks that property against randomized
 * data. If you change either, change both.
 *
 * Mapping of the engine's READ evaluation:
 *   1-3  tenant / active / "document.read" capability  → organizationId filter or match-nothing
 *   4    a matching DENY entry for READ                  → NOT permissions.some(DENY, READ, subject)
 *   5    owner, or a matching ALLOW entry (any action;   → ownerId = user
 *        WRITE/DELETE/SHARE imply READ) unless PRIVATE     OR (visibility ≠ PRIVATE AND permissions.some(ALLOW, subject))
 *   6    visibility audience                            → ORGANIZATION, or DEPARTMENT/TEAM/ROLE with a matching audience row
 */
export function readableDocumentsWhere(context: AuthorizationContext): Prisma.DocumentWhereInput {
  if (!context.active || !context.permissions.has('document.read')) {
    return { id: { in: [] } }; // matches nothing
  }

  const subject = aclSubjectMatches(context);
  const audience = (ids: ReadonlySet<string>) => ({ some: { targetId: { in: [...ids] } } });

  return {
    organizationId: context.organizationId,
    NOT: { permissions: { some: { effect: 'DENY', permission: 'READ', OR: subject } } },
    OR: [
      { ownerId: context.userId },
      { visibility: { not: 'PRIVATE' }, permissions: { some: { effect: 'ALLOW', OR: subject } } },
      { visibility: 'ORGANIZATION' },
      { visibility: 'DEPARTMENT', audience: audience(context.departmentIds) },
      { visibility: 'TEAM', audience: audience(context.teamIds) },
      { visibility: 'ROLE', audience: audience(context.roleIds) },
    ],
  };
}

function aclSubjectMatches(context: AuthorizationContext): Prisma.DocumentPermissionWhereInput[] {
  return [
    { subjectType: 'USER', subjectId: context.userId },
    { subjectType: 'ROLE', subjectId: { in: [...context.roleIds] } },
    { subjectType: 'TEAM', subjectId: { in: [...context.teamIds] } },
    { subjectType: 'DEPARTMENT', subjectId: { in: [...context.departmentIds] } },
  ];
}

/** Everything the engine needs from a stored document. */
export const protectedDocumentSelect = {
  organizationId: true,
  ownerId: true,
  visibility: true,
  audience: { select: { targetId: true } },
  permissions: { select: { subjectType: true, subjectId: true, permission: true, effect: true } },
} satisfies Prisma.DocumentSelect;

export type ProtectedDocumentRow = Prisma.DocumentGetPayload<{ select: typeof protectedDocumentSelect }>;

/** Maps a stored document to the engine's ProtectedResource. */
export function toProtectedResource(row: ProtectedDocumentRow): ProtectedResource {
  return {
    organizationId: row.organizationId,
    ownerId: row.ownerId,
    visibility: row.visibility,
    audienceIds: row.audience.map((a) => a.targetId),
    acl: row.permissions.map((entry): AclEntry => ({
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      action: entry.permission,
      effect: entry.effect,
    })),
  };
}
