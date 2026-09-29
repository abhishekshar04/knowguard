import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

import { unauthenticated } from '../common/api-exception';
import type { AuthContext, AuthenticatedRequest } from './auth-context';

export const IS_PUBLIC_KEY = 'knowguard:isPublic';
export const REQUIRE_VERIFIED_EMAIL_KEY = 'knowguard:requireVerifiedEmail';

/**
 * Opts a route out of authentication. Every route is authenticated by default
 * (global SessionAuthGuard) — forgetting a decorator fails closed, not open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Sensitive operations (e.g. inviting users, sharing documents) require a verified email. */
export const RequireVerifiedEmail = () => SetMetadata(REQUIRE_VERIFIED_EMAIL_KEY, true);

/** Injects the request's AuthContext. Throws if used on a route without authentication. */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const auth = ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth;
  if (!auth) throw unauthenticated();
  return auth;
});
