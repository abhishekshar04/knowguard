import { createHash, randomBytes } from 'node:crypto';

import { HttpStatus, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { hashPassword, verifyPassword } from '@knowguard/auth';
import { Prisma } from '@knowguard/database';
import type { MeResponse, SessionGrant } from '@knowguard/types';
import type { LoginInput, RegisterInput } from '@knowguard/validation';

import { AuditService } from '../audit/audit.service';
import { ApiException, unauthenticated } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { type RateLimitRule, RateLimiterService } from '../common/rate-limiter.service';
import type { RequestMeta } from '../common/request-meta';
import { OrganizationsService } from '../organizations/organizations.service';
import type { AuthContext } from './auth-context';
import { SessionService } from './session.service';

/** Brute-force and abuse limits. See docs/adr/0005-identity-membership-and-sessions.md. */
export const AUTH_RATE_LIMITS = {
  /** All login attempts from one client IP. */
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  /**
   * Login attempts for one email since its last successful login, from any IP. A temporary
   * lock, applied to unknown emails too. Each attempt is counted BEFORE the password check
   * (one atomic INCR), so concurrent guesses cannot overshoot the limit.
   */
  loginAttemptsPerEmail: { limit: 10, windowSeconds: 15 * 60 },
  /** Account/organization creation from one client IP. */
  registerPerIp: { limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

const REGISTRATION_ATTEMPTS = 3;

const invalidCredentials = (): ApiException =>
  new ApiException('INVALID_CREDENTIALS', 'Invalid email or password.', HttpStatus.UNAUTHORIZED);

/** Emails are personal data: rate-limit keys use a hash, never the address itself. */
const emailKey = (email: string): string => createHash('sha256').update(email).digest('hex');

function uniqueViolationOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target).includes(field);
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the email is unknown, so both paths cost one argon2 verification. */
  private dummyPasswordHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly organizations: OrganizationsService,
    private readonly rateLimiter: RateLimiterService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await hashPassword(randomBytes(32).toString('hex'));
  }

  /**
   * Self-serve signup: creates the user, a new organization with system roles, an OWNER
   * membership and a session — atomically. Email starts unverified.
   */
  async register(input: RegisterInput, meta: RequestMeta): Promise<SessionGrant> {
    await this.rateLimiter.consume(`register:ip:${meta.ip}`, AUTH_RATE_LIMITS.registerPerIp);

    const passwordHash = await hashPassword(input.password);

    for (let attempt = 1; ; attempt++) {
      const slug = await this.organizations.pickAvailableSlug(input.organizationName);
      try {
        const issued = await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              passwordHash,
              status: 'ACTIVE',
              lastLoginAt: new Date(), // registration signs the user in
            },
            select: { id: true },
          });
          const organization = await this.organizations.createWithOwner(tx, {
            name: input.organizationName,
            slug,
            ownerId: user.id,
          });
          const session = await this.sessions.issue(tx, {
            userId: user.id,
            organizationId: organization.id,
            meta,
          });
          return { ...session, userId: user.id, organizationId: organization.id };
        });
        const actor = { userId: issued.userId, organizationId: issued.organizationId };
        await this.audit.record({
          actor,
          action: 'USER_CREATED',
          resourceType: 'USER',
          resourceId: issued.userId,
          metadata: { via: 'REGISTRATION', roles: ['OWNER'] },
        });
        return { token: issued.token, expiresAt: issued.expiresAt.toISOString() };
      } catch (error) {
        if (uniqueViolationOn(error, 'email')) {
          // Registration inherently reveals that an address is taken; the IP rate limit bounds
          // enumeration. Verification-email-based signup removes this (see ADR 0005).
          throw new ApiException(
            'EMAIL_UNAVAILABLE',
            'This email address cannot be used to register.',
            HttpStatus.CONFLICT,
          );
        }
        if (uniqueViolationOn(error, 'slug') && attempt < REGISTRATION_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  /**
   * Password login. Every failure — unknown email, wrong password, no password set, suspended
   * or deactivated account, no active membership — returns the same INVALID_CREDENTIALS
   * response after the same amount of work.
   */
  async login(input: LoginInput, meta: RequestMeta): Promise<SessionGrant> {
    const emailAttemptsKey = `login:email:${emailKey(input.email)}`;
    await this.rateLimiter.consume(`login:ip:${meta.ip}`, AUTH_RATE_LIMITS.loginPerIp);
    await this.rateLimiter.consume(emailAttemptsKey, AUTH_RATE_LIMITS.loginAttemptsPerEmail);

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        memberships: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { organizationId: true },
        },
      },
    });

    const passwordOk = await verifyPassword(user?.passwordHash ?? this.dummyPasswordHash, input.password);
    const membership = user?.memberships[0];

    if (!user || !user.passwordHash || !passwordOk || user.status !== 'ACTIVE' || !membership) {
      if (user && membership) {
        // Not awaited: a known account must not answer measurably slower than an unknown one.
        this.audit.recordInBackground({
          actor: { userId: user.id, organizationId: membership.organizationId },
          action: 'LOGIN_FAILED',
          resourceType: 'SESSION',
          result: 'FAILURE',
          metadata: { reason: user.status !== 'ACTIVE' ? 'ACCOUNT_INACTIVE' : 'INVALID_PASSWORD' },
        });
      }
      throw invalidCredentials();
    }

    // Success clears the attempt counter so legitimate users aren't penalised for earlier typos.
    await this.rateLimiter.reset(emailAttemptsKey);
    const issued = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return this.sessions.issue(tx, { userId: user.id, organizationId: membership.organizationId, meta });
    });
    await this.audit.record({
      actor: { userId: user.id, organizationId: membership.organizationId },
      action: 'LOGIN',
      resourceType: 'SESSION',
    });
    return { token: issued.token, expiresAt: issued.expiresAt.toISOString() };
  }

  async logout(auth: AuthContext): Promise<void> {
    await this.sessions.revoke(auth.sessionId, 'logout');
  }

  /** Everything is scoped by the session's user and organization — never by client input. */
  async me(auth: AuthContext): Promise<MeResponse> {
    const [user, organization] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, email: true, name: true, emailVerifiedAt: true },
      }),
      this.prisma.organization.findUnique({
        where: { id: auth.organizationId },
        select: { id: true, name: true, slug: true },
      }),
    ]);
    if (!user || !organization) {
      this.logger.warn(`Session ${auth.sessionId} references a missing user or organization`);
      throw unauthenticated();
    }

    return {
      user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerifiedAt !== null },
      organization,
      roles: [...auth.roles],
      permissions: [...auth.permissions].sort(),
      session: { expiresAt: auth.sessionExpiresAt.toISOString() },
    };
  }
}
