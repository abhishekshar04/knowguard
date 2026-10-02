import type { AuditActionValue, AuditLogEntry, AuditResultValue } from '@knowguard/types';

import { Badge } from '@/components/ui/badge';

export const ACTION_LABELS: Record<AuditActionValue, string> = {
  DOCUMENT_VIEW: 'Viewed document',
  DOCUMENT_DOWNLOAD: 'Downloaded document',
  DOCUMENT_CREATE: 'Uploaded document',
  DOCUMENT_UPDATE: 'Updated document',
  DOCUMENT_DELETE: 'Deleted document',
  DOCUMENT_SHARE: 'Changed document visibility',
  PERMISSION_CHANGE: 'Changed permissions',
  USER_CREATED: 'Joined organization',
  USER_INVITED: 'Invited user',
  USER_SUSPENDED: 'Suspended user',
  USER_REACTIVATED: 'Reactivated user',
  ROLE_CHANGED: "Changed a member's roles",
  GROUP_CHANGED: 'Changed team or department',
  LOGIN: 'Signed in',
  LOGIN_FAILED: 'Failed sign-in',
  ACCESS_DENIED: 'Access denied',
  SEARCH: 'Searched',
  AI_QUERY: 'Asked AI',
};

const RESULT_VARIANT: Record<AuditResultValue, 'success' | 'destructive' | 'secondary'> = {
  SUCCESS: 'secondary',
  DENIED: 'destructive',
  FAILURE: 'destructive',
};

export function ResultBadge({ result }: { result: AuditResultValue }) {
  return <Badge variant={RESULT_VARIANT[result]}>{result.toLowerCase()}</Badge>;
}

const RESOURCE_NAMES: Record<AuditLogEntry['resourceType'], string> = {
  DOCUMENT: 'Document',
  USER: 'User',
  ROLE: 'Role',
  TEAM: 'Team',
  DEPARTMENT: 'Department',
  CONVERSATION: 'Conversation',
  SESSION: 'Session',
  ENDPOINT: 'Request',
};

/** "Document “Title”", or "Document 0190f7c8…" when the viewer may not see the name. */
export function resourceText(entry: AuditLogEntry): string {
  const kind = RESOURCE_NAMES[entry.resourceType];
  if (entry.resourceLabel) return `${kind} “${entry.resourceLabel}”`;
  if (entry.resourceId) return `${kind} ${entry.resourceId.slice(0, 8)}…`;
  return kind;
}

/** Compact, readable one-line summary of an entry's metadata. */
export function metadataText(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(
      ([, value]) => value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
    )
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}
