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
  };
}

export const USER_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

/** BullMQ queue names shared by the API (producer) and worker (consumer). */
export const QUEUE_NAMES = {
  ingestion: 'ingestion',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

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
