import { type NextRequest, NextResponse } from 'next/server';

import { sessionCookieName } from '@/lib/session-cookie';

// /invite: invitees have no session yet — the one-time token in the URL is their credential.
const PUBLIC_PATHS = ['/login', '/register', '/invite'];

/**
 * Optimistic routing only: sends visitors without a session cookie to /login before rendering.
 * This is NOT the security check — protected layouts/pages validate the session with the API
 * (requireUser), and the API authorizes every request itself.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPublic || request.cookies.has(sessionCookieName())) return NextResponse.next();

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
