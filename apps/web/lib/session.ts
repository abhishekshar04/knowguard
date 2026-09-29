import 'server-only';

import type { MeResponse } from '@knowguard/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ApiError, apiRequest } from './api';
import { sessionCookieName } from './session-cookie';

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

/**
 * The authenticated user for this request, or null. The API re-validates the session on
 * every call (revocation, expiry, suspension), so this is authoritative — not a cookie check.
 * Memoised per request so layouts and pages share one API call.
 */
export const getCurrentUser = cache(async (): Promise<MeResponse | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiRequest<MeResponse>('/auth/me', { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/** Where a stale cookie (revoked/expired session) is cleared before going to /login. */
export const SESSION_ENDED_PATH = '/auth/session-ended';

/**
 * Use in every protected layout/page. Redirects to /login when there is no valid session —
 * via SESSION_ENDED_PATH when a cookie is present but dead, so the browser drops it instead of
 * re-sending it (and costing an API round-trip) on every later visit.
 */
export async function requireUser(): Promise<MeResponse> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect((await getSessionToken()) ? SESSION_ENDED_PATH : '/login');
}

/**
 * For public pages (sign-in, registration) that only want to bounce signed-in users.
 * Never throws: if the API is unreachable, the page still renders so the user sees a form
 * and a useful error on submit, rather than a crash.
 */
export async function getCurrentUserIfAvailable(): Promise<MeResponse | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

/** Only same-origin relative paths are allowed as post-login destinations (no open redirect). */
export function safeRedirectPath(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
