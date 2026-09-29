import { Inject, Injectable } from '@nestjs/common';
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from '@knowguard/auth';
import type { Prisma } from '@knowguard/database';

import { PrismaService } from '../common/prisma.service';
import type { RequestMeta } from '../common/request-meta';
import { API_ENV, type ApiEnv } from '../config/api-env';
import type { AuthContext } from './auth-context';
import { evaluateSession } from './session-policy';

type Db = PrismaService | Prisma.TransactionClient;

export interface IssuedSession {
  sessionId: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly ttlMs: number;
  private readonly idleTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_ENV) env: ApiEnv,
  ) {
    this.ttlMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
    this.idleTimeoutMs = env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  }

  /** Issues a new session for a membership. Pass a transaction client to issue atomically. */
  async issue(
    db: Db,
    input: { userId: string; organizationId: string; meta: RequestMeta },
  ): Promise<IssuedSession> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const session = await db.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: input.userId,
        organizationId: input.organizationId,
        expiresAt,
        ipAddress: input.meta.ip.slice(0, 45),
        userAgent: input.meta.userAgent,
      },
      select: { id: true },
    });
    return { sessionId: session.id, token, expiresAt };
  }

  /**
   * Resolves a bearer token to an AuthContext, or null. Every request re-checks revocation,
   * expiry, idle timeout and account/membership status, so logout and suspension are immediate.
   */
  async authenticate(token: string): Promise<AuthContext | null> {
    if (!isWellFormedSessionToken(token)) return null;

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        expiresAt: true,
        lastSeenAt: true,
        revokedAt: true,
        user: { select: { email: true, status: true, emailVerifiedAt: true } },
        membership: { select: { status: true } },
      },
    });
    if (!session) return null;

    const now = new Date();
    const verdict = evaluateSession(
      {
        expiresAt: session.expiresAt,
        lastSeenAt: session.lastSeenAt,
        revokedAt: session.revokedAt,
        userStatus: session.user.status,
        membershipStatus: session.membership.status,
      },
      now,
      this.idleTimeoutMs,
    );

    if (!verdict.valid) {
      if (verdict.reason !== 'revoked') await this.revoke(session.id, verdict.reason);
      return null;
    }
    if (verdict.touch) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      organizationId: session.organizationId,
      email: session.user.email,
      emailVerified: session.user.emailVerifiedAt !== null,
      sessionExpiresAt: session.expiresAt,
    };
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Used when an account is suspended/deactivated or its password changes (Phase 3+). */
  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }
}
