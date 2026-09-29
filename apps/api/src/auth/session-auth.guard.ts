import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_PERMISSIONS_KEY } from '../authorization/require-permission.decorator';
import { ApiException, forbidden, unauthenticated } from '../common/api-exception';
import type { AuthenticatedRequest } from './auth-context';
import { IS_PUBLIC_KEY, REQUIRE_VERIFIED_EMAIL_KEY } from './auth.decorators';
import { SessionService } from './session.service';

const BEARER = /^Bearer ([A-Za-z0-9_-]+)$/;

/**
 * Global guard: every route requires a valid session unless marked @Public().
 * The session token arrives as a bearer token from the Next.js BFF, which keeps it in an
 * HttpOnly cookie; browsers never call the API directly with credentials.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw unauthenticated();

    const auth = await this.sessions.authenticate(token);
    if (!auth) throw unauthenticated();
    request.auth = auth;

    if (
      this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_EMAIL_KEY, targets) &&
      !auth.emailVerified
    ) {
      throw new ApiException(
        'EMAIL_NOT_VERIFIED',
        'Verify your email address to perform this action.',
        HttpStatus.FORBIDDEN,
      );
    }
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      targets,
    );
    if (required && !required.every((permission) => auth.permissions.has(permission))) {
      throw forbidden();
    }
    return true;
  }
}
