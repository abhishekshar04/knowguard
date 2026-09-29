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
