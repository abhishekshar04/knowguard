import 'server-only';

import { type ApiErrorBody, FORWARDED_USER_AGENT_HEADER, type HealthResponse } from '@knowguard/types';
import { headers } from 'next/headers';

/**
 * Server-side API client used by the BFF (server components and server actions).
 * The browser never calls the API: it only holds an HttpOnly cookie for this origin,
 * and the BFF forwards the session as a bearer token server-to-server.
 */
function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) throw new Error('API_URL is not configured');
  return new URL(`/api/v1${path}`, base).toString();
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ReadonlyArray<{ path: string; message: string }> = [],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The end user's IP as seen by this server. Uses the RIGHTMOST X-Forwarded-For entry — the
 * one appended by the nearest trusted hop — because leftmost entries are client-controlled.
 * In production a reverse proxy/load balancer in front of Next.js must append it.
 */
function clientIp(forwardedFor: string | null): string | undefined {
  const hops = forwardedFor
    ?.split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops?.at(-1);
}

async function forwardedHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const forwarded: Record<string, string> = {};
  const ip = clientIp(incoming.get('x-forwarded-for'));
  if (ip) forwarded['x-forwarded-for'] = ip;
  const agent = incoming.get('user-agent');
  if (agent) forwarded[FORWARDED_USER_AGENT_HEADER] = agent.slice(0, 512);
  return forwarded;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: {
      ...(await forwardedHeaders()),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return undefined as T;
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, payload);
  return payload as T;
}

/** multipart/form-data passthrough (uploads). The API validates file type, size and fields. */
export async function apiUpload<T>(path: string, form: FormData, token: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
    headers: { ...(await forwardedHeaders()), Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, payload);
  return payload as T;
}

/** Raw response (file downloads): the caller streams the body onward. */
export async function apiFetchRaw(path: string, token: string): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
    headers: { ...(await forwardedHeaders()), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw toApiError(res, await res.json().catch(() => null));
  return res;
}

function toApiError(res: Response, payload: unknown): ApiError {
  const error = (payload as ApiErrorBody | null)?.error;
  const retryAfter = Number(res.headers.get('retry-after'));
  return new ApiError(
    res.status,
    error?.code ?? 'INTERNAL_ERROR',
    error?.message ?? 'An unexpected error occurred.',
    error?.details ?? [],
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );
}

export type HealthResult = { reachable: true; health: HealthResponse } | { reachable: false };

export async function getApiHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(apiUrl('/health'), { cache: 'no-store', signal: AbortSignal.timeout(3_000) });
    // 503 still carries a valid (degraded) health payload.
    if (!res.ok && res.status !== 503) return { reachable: false };
    return { reachable: true, health: (await res.json()) as HealthResponse };
  } catch {
    return { reachable: false };
  }
}
