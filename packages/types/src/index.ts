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
  /** Index a newly uploaded version (extract → chunk → embed → store). */
  processDocument: 'PROCESS_DOCUMENT',
  /** Re-run the pipeline for the current version (failed ingestion, model or chunker changes). */
  reindexDocument: 'REINDEX_DOCUMENT',
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
  /** User-safe reason when status is FAILED. */
  processingError: string | null;
  /** When the current version finished indexing (searchable from then on). */
  indexedAt: string | null;
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
  /** Number of indexed chunks of the current version. */
  chunkCount: number;
  versions: DocumentVersionSummary[];
  audience: SubjectRef[];
  /** Only present when the caller may SHARE (manage access to) the document. */
  acl: AclEntryView[] | null;
}

// ── Search (Phase 7) ─────────────────────────────────────────────────────────────────────

/** One search hit: the best-matching passage of a document the caller may read. */
export interface SearchResult {
  documentId: string;
  title: string;
  /** Plain text (never HTML); highlight on the client by matching query terms. */
  snippet: string;
  /** Relevance in [0, 1]. */
  score: number;
  page: number | null;
  section: string | null;
  chunkId: string;
  versionId: string;
  version: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

// ── Ask AI (Phase 8) ─────────────────────────────────────────────────────────────────────

/** A source passage given to the model; `index` is the number used in [n] citations. */
export interface AiSource {
  index: number;
  documentId: string;
  documentTitle: string;
  version: number;
  versionId: string;
  page: number | null;
  section: string | null;
  chunkId: string;
  /** Whether the answer actually cites this source. */
  cited: boolean;
}

export interface AiUsage {
  promptTokens: number;
  outputTokens: number;
}

/**
 * Server-sent events of POST /ai/query, in order:
 * meta → sources → delta* → done   (or error at any point after meta)
 */
export type AiStreamEvent =
  | { event: 'meta'; data: { conversationId: string } }
  | { event: 'sources'; data: { sources: AiSource[] } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'done'; data: { messageId: string; answer: string; sources: AiSource[]; usage: AiUsage | null } }
  | { event: 'error'; data: { code: string; message: string } };

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ConversationMessageView {
  id: string;
  role: 'USER' | 'ASSISTANT';
  status: 'COMPLETE' | 'FAILED';
  content: string;
  sources: AiSource[];
  createdAt: string;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
}

export interface ConversationDetails extends ConversationSummary {
  messages: ConversationMessageView[];
}

export interface AiStatusResponse {
  /** Whether an answer-generation provider is configured. */
  available: boolean;
  model: string | null;
}

/** GET /documents/:id/preview: the start of a text document; null for other file types. */
export interface DocumentPreviewResponse {
  preview: { text: string; truncated: boolean } | null;
}

// ── Audit and analytics (Phase 9) ────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = [
  'DOCUMENT_VIEW',
  'DOCUMENT_DOWNLOAD',
  'DOCUMENT_CREATE',
  'DOCUMENT_UPDATE',
  'DOCUMENT_DELETE',
  'DOCUMENT_SHARE',
  'PERMISSION_CHANGE',
  'USER_CREATED',
  'USER_INVITED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'ROLE_CHANGED',
  'GROUP_CHANGED',
  'LOGIN',
  'LOGIN_FAILED',
  'ACCESS_DENIED',
  'SEARCH',
  'AI_QUERY',
] as const;
export type AuditActionValue = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESULTS = ['SUCCESS', 'DENIED', 'FAILURE'] as const;
export type AuditResultValue = (typeof AUDIT_RESULTS)[number];

export const AUDIT_RESOURCE_TYPES = [
  'DOCUMENT',
  'USER',
  'ROLE',
  'TEAM',
  'DEPARTMENT',
  'CONVERSATION',
  'SESSION',
  'ENDPOINT',
] as const;
export type AuditResourceTypeValue = (typeof AUDIT_RESOURCE_TYPES)[number];

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: AuditActionValue;
  result: AuditResultValue;
  /** Null for system actions; `name`/`email` are null if the user no longer exists. */
  actor: { id: string; name: string | null; email: string | null } | null;
  resourceType: AuditResourceTypeValue;
  resourceId: string | null;
  /**
   * Human-readable name of the resource, when the viewer may see it. Document titles are only
   * shown for documents the viewer can read, so the audit log never discloses them.
   */
  resourceLabel: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  /** Pass as `cursor` to fetch older entries; null at the end. */
  nextCursor: string | null;
}

export interface AnalyticsDay {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  searches: number;
  aiQueries: number;
  views: number;
  downloads: number;
  uploads: number;
  denied: number;
}

export interface AnalyticsOverview {
  days: number;
  members: { active: number; suspended: number; invited: number };
  documents: {
    total: number;
    byStatus: Partial<Record<DocumentStatusValue, number>>;
    storageBytes: number;
    chunks: number;
  };
  activity: AnalyticsDay[];
  ai: {
    questions: number;
    answered: number;
    notFound: number;
    failed: number;
    promptTokens: number;
    outputTokens: number;
  };
  /** Most viewed or cited documents; titles only for documents the viewer can read. */
  topDocuments: Array<{ documentId: string; title: string | null; views: number; citations: number }>;
  topUsers: Array<{ user: { id: string; name: string | null; email: string | null }; events: number }>;
}
