/**
 * Shared, framework-free contract types used across apps (api, worker, web).
 * Keep this package dependency-free: it must be safe to import from the browser.
 */

/** Uniform error envelope returned by every API error response. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Present only for request-validation failures; never contains stored data. */
    details?: ReadonlyArray<{ path: string; message: string }>;
  };
}

export type DependencyStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
    storage: DependencyStatus;
  };
}

export const USER_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

/** BullMQ queue names shared by the API (producer) and worker (consumer). */
export const QUEUE_NAMES = {
  ingestion: 'ingestion',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Ingestion job names (spec §17). Producers: API. Consumer: worker (Phase 6). */
export const INGESTION_JOBS = {
  processDocument: 'PROCESS_DOCUMENT',
} as const;

export interface ProcessDocumentJob {
  organizationId: string;
  documentId: string;
  versionId: string;
}

/**
 * Returned by register/login to the Next.js BFF only (server-to-server). The BFF moves the
 * token into an HttpOnly cookie; it is never exposed to browser JavaScript.
 */
export interface SessionGrant {
  token: string;
  expiresAt: string;
}

/** GET /auth/me — the authenticated principal and its tenant context. */
export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  /** Role keys in the current organization, for display. Authorization is always server-side. */
  roles: string[];
  permissions: string[];
  session: {
    expiresAt: string;
  };
}

/** Header the BFF uses to forward the end user's user-agent to the API. */
export const FORWARDED_USER_AGENT_HEADER = 'x-knowguard-user-agent';

// ── Organization administration (Phase 3) ────────────────────────────────────────────────

export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED';

export interface NamedRef {
  id: string;
  name: string;
}

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  /** Effective status in the caller's organization (membership suspension wins). */
  status: MemberStatus;
  emailVerified: boolean;
  roles: string[];
  departments: NamedRef[];
  teams: NamedRef[];
  joinedAt: string;
  lastLoginAt: string | null;
  /**
   * Whether the CALLER may change this member's roles/status (not themselves, and not a member
   * holding permissions the caller lacks). A UI hint only — the API re-checks every change.
   */
  manageable: boolean;
}

export interface MemberListResponse {
  members: MemberSummary[];
}

export interface InvitationGrant {
  /** One-time token; the BFF turns it into /invite/<token>. Shown to the inviting admin once. */
  token: string;
  expiresAt: string;
}

export interface InviteMemberResponse {
  member: MemberSummary;
  invitation: InvitationGrant;
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
  name: string;
  expiresAt: string;
}

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
  /** Whether the caller may assign this role (its permissions are a subset of the caller's). */
  assignable: boolean;
  /**
   * Whether the caller may edit/delete it: custom (not system), within the caller's own access,
   * and not a role the caller holds. A UI hint — the API re-checks.
   */
  editable: boolean;
}

export interface PermissionInfo {
  key: string;
  description: string;
  /** Resource part of the key, e.g. "document" for "document.read". */
  group: string;
}

export interface PermissionListResponse {
  permissions: PermissionInfo[];
}

export interface RoleListResponse {
  roles: RoleSummary[];
}

export interface OrganizationDetails {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
}

export interface MemberRef {
  id: string;
  name: string;
  email: string;
}

export interface DepartmentDetails {
  id: string;
  name: string;
  description: string | null;
  teams: NamedRef[];
  members: MemberRef[];
}

export interface TeamDetails {
  id: string;
  name: string;
  description: string | null;
  department: NamedRef;
  members: MemberRef[];
}

export interface DepartmentListResponse {
  departments: DepartmentDetails[];
}

export interface TeamListResponse {
  teams: TeamDetails[];
}

// ── Documents (Phase 5) ──────────────────────────────────────────────────────────────────

export type DocumentVisibilityValue = 'PRIVATE' | 'CUSTOM' | 'ROLE' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION';
export type DocumentStatusValue = 'UPLOADING' | 'PROCESSING' | 'INDEXING' | 'READY' | 'FAILED' | 'ARCHIVED';
export type DocumentActionValue = 'READ' | 'WRITE' | 'DELETE' | 'SHARE';
export type AclSubjectTypeValue = 'USER' | 'ROLE' | 'TEAM' | 'DEPARTMENT';

/** What the CALLER may do with a document, as decided by the authorization engine. */
export interface DocumentCapabilities {
  write: boolean;
  delete: boolean;
  share: boolean;
}

export interface DocumentSummary {
  id: string;
  title: string;
  description: string | null;
  owner: MemberRef;
  visibility: DocumentVisibilityValue;
  status: DocumentStatusValue;
  mimeType: string;
  size: number;
  version: number;
  updatedAt: string;
  capabilities: DocumentCapabilities;
}

export interface DocumentListResponse {
  documents: DocumentSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DocumentVersionSummary {
  id: string;
  version: number;
  originalFilename: string;
  mimeType: string;
  size: number;
  contentHash: string;
  createdBy: MemberRef;
  createdAt: string;
}

/** A named target (role, team or department) for audiences and ACL subjects. */
export interface SubjectRef {
  type: AclSubjectTypeValue;
  id: string;
  name: string;
}

export interface AclEntryView {
  subject: SubjectRef;
  permission: DocumentActionValue;
  effect: 'ALLOW' | 'DENY';
}

export interface DocumentDetails extends DocumentSummary {
  createdAt: string;
  versions: DocumentVersionSummary[];
  audience: SubjectRef[];
  /** Only present when the caller may SHARE (manage access to) the document. */
  acl: AclEntryView[] | null;
}
