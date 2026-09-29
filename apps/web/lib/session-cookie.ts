/**
 * Session cookie settings, shared by server actions, server components and proxy.ts.
 *
 * The cookie holds the opaque session token issued by the API. It is:
 *  - HttpOnly: unreadable by JavaScript, so XSS cannot exfiltrate it;
 *  - SameSite=Lax: not sent on cross-site POSTs (CSRF), still sent on top-level navigation;
 *  - Secure + "__Host-" prefix in production: HTTPS-only, host-locked, path=/.
 */
export function sessionCookieSecure(): boolean {
  const configured = process.env.SESSION_COOKIE_SECURE;
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieName(): string {
  return sessionCookieSecure() ? '__Host-kg_session' : 'kg_session';
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}
