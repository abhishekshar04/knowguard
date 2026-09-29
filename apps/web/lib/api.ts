import 'server-only';

import type { HealthResponse } from '@knowguard/types';

/**
 * Server-side API access. The browser never talks to the API with credentials it
 * holds in JS; authenticated calls will be proxied through the Next.js server (Phase 2).
 */
function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) throw new Error('API_URL is not configured');
  return new URL(`/api/v1${path}`, base).toString();
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
