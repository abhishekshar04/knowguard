import { type NextRequest, NextResponse } from 'next/server';

import { sessionCookieName } from '@/lib/session-cookie';

// /invite: invitees have no session yet — the one-time token in the URL is their credential.
const PUBLIC_PATHS = ['/login', '/register', '/invite'];

/** Route handlers that set their own, stricter policy (sandboxed document files). */
const OWN_POLICY = /^\/documents\/[^/]+\/file$/;

/**
 * Strict Content Security Policy (ADR 0013): scripts run only with this request's nonce (Next.js
 * applies it to its own scripts automatically), nothing loads from other origins, and the app
 * cannot be framed. A new third-party script, font or API origin needs a deliberate change here.
 */
export function contentSecurityPolicy(nonce: string, options: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Inline style ATTRIBUTES (e.g. a chart bar's computed height) cannot run code.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${options.dev ? ' ws: wss:' : ''}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/**
 * Runs before every page request:
 *  1. Optimistic routing only: sends visitors without a session cookie to /login before
 *     rendering. This is NOT the security check — protected layouts/pages validate the session
 *     with the API (requireUser), and the API authorizes every request itself.
 *  2. Sets a per-request nonce and the Content-Security-Policy.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isPublic && !request.cookies.has(sessionCookieName())) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (OWN_POLICY.test(pathname)) return NextResponse.next();

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const https = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  const policy = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === 'development', https });

  // Next.js reads the nonce from the request's CSP header while rendering.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
