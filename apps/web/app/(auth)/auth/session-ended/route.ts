import { type NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/session';
import { sessionCookieName, sessionCookieOptions } from '@/lib/session-cookie';

/**
 * Clears a dead session cookie, then continues to /login.
 *
 * Only clears when the API confirms the session is invalid: a GET that blindly deleted the
 * cookie could be triggered cross-site (e.g. an <img> tag) to log users out. If the session is
 * valid it goes back to the dashboard; if the API is unreachable the cookie is left alone.
 */
export async function GET(request: NextRequest) {
  let valid: boolean;
  try {
    valid = (await getCurrentUser()) !== null;
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (valid) return NextResponse.redirect(new URL('/dashboard', request.url));

  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.set(sessionCookieName(), '', { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
