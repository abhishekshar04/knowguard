import { HttpStatus, Injectable } from '@nestjs/common';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isWellFormedSessionToken,
} from '@knowguard/auth';
import type { Prisma } from '@knowguard/database';
import type { InvitationGrant, InvitationPreview, SessionGrant } from '@knowguard/types';
import type { AcceptInvitationInput } from '@knowguard/validation';

import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { type RateLimitRule, RateLimiterService } from '../common/rate-limiter.service';
import type { RequestMeta } from '../common/request-meta';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Preview + accept, per client IP. Tokens are 256-bit, so this limits abuse, not guessing. */
const INVITATION_RATE_LIMIT: RateLimitRule = { limit: 30, windowSeconds: 15 * 60 };

/** One message for unknown, expired, revoked, used and suspended-membership invitations. */
const invalidInvitation = (): ApiException =>
  new ApiException(
    'INVITATION_INVALID',
    'This invitation link is invalid or has expired. Ask your administrator for a new one.',
    HttpStatus.NOT_FOUND,
  );

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly rateLimiter: RateLimiterService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Issues a fresh invitation for an INVITED membership, revoking any outstanding ones so
   * only the newest link works. Call inside the caller's transaction.
   */
  async issue(
    tx: Prisma.TransactionClient,
    input: { userId: string; organizationId: string; invitedById: string },
  ): Promise<InvitationGrant> {
    await this.revokeOutstanding(tx, input.userId, input.organizationId);
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    await tx.invitation.create({
      data: { ...input, tokenHash: hashSessionToken(token), expiresAt },
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async revokeOutstanding(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await tx.invitation.updateMany({
      where: { userId, organizationId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async preview(token: string, meta: RequestMeta): Promise<InvitationPreview> {
    await this.rateLimiter.consume(`invitation:ip:${meta.ip}`, INVITATION_RATE_LIMIT);
    const invitation = await this.findUsable(token);
    return {
      organizationName: invitation.membership.organization.name,
      email: invitation.membership.user.email,
      name: invitation.membership.user.name,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Sets the invitee's password, activates account + membership, and signs them in.
   * The invitation is claimed with a conditional update, so two concurrent accepts of the
   * same link cannot both succeed.
   */
  async accept(token: string, input: AcceptInvitationInput, meta: RequestMeta): Promise<SessionGrant> {
    await this.rateLimiter.consume(`invitation:ip:${meta.ip}`, INVITATION_RATE_LIMIT);
    const invitation = await this.findUsable(token);
    const passwordHash = await hashPassword(input.password);
    const { userId, organizationId } = invitation;

    const issued = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      const activatedUser = await tx.user.updateMany({
        where: { id: userId, status: 'INVITED' },
        data: {
          passwordHash,
          status: 'ACTIVE',
          lastLoginAt: new Date(),
          ...(input.name ? { name: input.name } : {}),
        },
      });
      const activatedMembership = await tx.userOrganization.updateMany({
        where: { userId, organizationId, status: 'INVITED' },
        data: { status: 'ACTIVE' },
      });
      if (claimed.count !== 1 || activatedUser.count !== 1 || activatedMembership.count !== 1) {
        throw invalidInvitation(); // rolls the whole transaction back
      }
      await this.revokeOutstanding(tx, userId, organizationId);
      return this.sessions.issue(tx, { userId, organizationId, meta });
    });
    await this.audit.record({
      actor: { userId, organizationId },
      action: 'USER_CREATED',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { via: 'INVITATION' },
    });
    return { token: issued.token, expiresAt: issued.expiresAt.toISOString() };
  }

  private async findUsable(token: string) {
    if (!isWellFormedSessionToken(token)) throw invalidInvitation();
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        membership: {
          select: {
            status: true,
            user: { select: { email: true, name: true, status: true } },
            organization: { select: { name: true } },
          },
        },
      },
    });
    const usable =
      invitation !== null &&
      !invitation.acceptedAt &&
      !invitation.revokedAt &&
      invitation.expiresAt.getTime() > Date.now() &&
      invitation.membership.status === 'INVITED' &&
      invitation.membership.user.status === 'INVITED';
    if (!usable) throw invalidInvitation();
    return invitation;
  }
}
