'use server';

import type { SessionGrant } from '@knowguard/types';
import { loginSchema, registerSchema } from '@knowguard/validation';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiError, apiRequest } from '@/lib/api';
import { getSessionToken, safeRedirectPath } from '@/lib/session';
import { sessionCookieName, sessionCookieOptions } from '@/lib/session-cookie';

/*
 * Server actions are the BFF's browser-facing surface for authentication. Next.js rejects
 * cross-origin action calls (Origin must match Host), and the session cookie is SameSite=Lax
 * and HttpOnly — the token never reaches browser JavaScript.
 */

export interface AuthFormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Echo non-secret fields back so the form keeps them after a failed submit. */
  values?: Record<string, string>;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function fieldErrorsFrom(issues: ReadonlyArray<{ path: string | PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path);
    errors[path] ??=
      `${path === 'organizationName' ? 'Organization name' : capitalize(path)} ${issue.message}`;
  }
  return errors;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'RATE_LIMITED') {
      const minutes = Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60));
      return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    }
    if (error.code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
    if (error.status < 500) return error.message;
    if (error.status !== 503) return 'Something went wrong. Please try again.';
  }
  // 503 from the API, or the API is unreachable (network error/timeout).
  return 'KnowGuard is temporarily unavailable. Please try again shortly.';
}

async function startSession(grant: SessionGrant): Promise<void> {
  (await cookies()).set(sessionCookieName(), grant.token, sessionCookieOptions(new Date(grant.expiresAt)));
}

export async function loginAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: field(form, 'email') };
  const parsed = loginSchema.safeParse({ email: values.email, password: field(form, 'password') });
  if (!parsed.success) return { values, fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  try {
    await startSession(await apiRequest<SessionGrant>('/auth/login', { method: 'POST', body: parsed.data }));
  } catch (error) {
    return { values, error: messageFor(error) };
  }
  redirect(safeRedirectPath(field(form, 'next')));
}

export async function registerAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = {
    name: field(form, 'name'),
    email: field(form, 'email'),
    organizationName: field(form, 'organizationName'),
  };
  const parsed = registerSchema.safeParse({ ...values, password: field(form, 'password') });
  if (!parsed.success) return { values, fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  try {
    await startSession(
      await apiRequest<SessionGrant>('/auth/register', { method: 'POST', body: parsed.data }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === 'EMAIL_UNAVAILABLE') {
      return { values, fieldErrors: { email: error.message } };
    }
    if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
      return { values, fieldErrors: fieldErrorsFrom(error.details) };
    }
    return { values, error: messageFor(error) };
  }
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    // Revoke server-side first; clear the cookie regardless so the browser is logged out
    // even if the API is briefly unreachable (the session then expires on its own).
    await apiRequest('/auth/logout', { method: 'POST', token }).catch(() => undefined);
  }
  // Expire with identical attributes: browsers ignore a "__Host-" deletion without Secure/path.
  (await cookies()).set(sessionCookieName(), '', { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  redirect('/login');
}
