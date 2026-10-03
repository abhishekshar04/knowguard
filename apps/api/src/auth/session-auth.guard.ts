import { type CanActivate, type ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { endpointMetadata, markAudited } from '../audit/access-denied.interceptor';
import { actorOf, AuditService } from '../audit/audit.service';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/require-permission.decorator';
import { ApiException, forbidden, unauthenticated } from '../common/api-exception';
import { RateLimiterService } from '../common/rate-limiter.service';
import { API_ENV, type ApiEnv } from '../config/api-env';
import type { AuthenticatedRequest } from './auth-context';
import { IS_PUBLIC_KEY, REQUIRE_VERIFIED_EMAIL_KEY } from './auth.decorators';
import { SessionService } from './session.service';

const BEARER = /^Bearer ([A-Za-z0-9_-]+)$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
    private readonly audit: AuditService,
    private readonly rateLimiter: RateLimiterService,
    @Inject(API_ENV) private readonly env: ApiEnv,
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

    // A per-member budget for the whole API, so no single session (or stolen token, or runaway
    // script in a new UI) can flood it. Counted per user, across all their sessions.
    await this.rateLimiter.consume(
      `api:user:${auth.userId}`,
      { limit: this.env.API_RATE_LIMIT_PER_MINUTE, windowSeconds: 60 },
      { failOpen: true },
    );
    if (!SAFE_METHODS.has(request.method)) {
      await this.rateLimiter.consume(
        `api:user-write:${auth.userId}`,
        { limit: this.env.API_WRITE_RATE_LIMIT_PER_MINUTE, windowSeconds: 60 },
        { failOpen: true },
      );
    }

    if (
      this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_EMAIL_KEY, targets) &&
      !auth.emailVerified
    ) {
      throw await this.denied(
        request,
        new ApiException(
          'EMAIL_NOT_VERIFIED',
          'Verify your email address to perform this action.',
          HttpStatus.FORBIDDEN,
        ),
      );
    }
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      targets,
    );
    if (required && !required.every((permission) => auth.permissions.has(permission))) {
      throw await this.denied(request, forbidden(), { required });
    }
    return true;
  }

  /** Capability failures are audited here: they never reach handlers or interceptors. */
  private async denied(
    request: AuthenticatedRequest,
    error: ApiException,
    extra: Record<string, unknown> = {},
  ): Promise<ApiException> {
    if (request.auth) {
      await this.audit.record({
        actor: actorOf(request.auth),
        action: 'ACCESS_DENIED',
        resourceType: 'ENDPOINT',
        result: 'DENIED',
        metadata: endpointMetadata(request, error.code, extra),
      });
    }
    return markAudited(error);
  }
}
