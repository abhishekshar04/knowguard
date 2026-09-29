import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@knowguard/database';
import type { InvitationGrant, InviteMemberResponse, MemberStatus, MemberSummary } from '@knowguard/types';
import type { InviteMemberInput } from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { SessionService } from '../auth/session.service';
import {
  canGrantRoles,
  canManageMember,
  MANAGEMENT_DENIAL_MESSAGES,
  type ManagementVerdict,
} from '../authorization/management-policy';
import { assertOwnershipRemains } from '../authorization/ownership';
import { permissionsOf, roleKeysOf, rolesWithPermissionsSelect } from '../authorization/role-permissions';
import { ApiException, notFound } from '../common/api-exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import { type RateLimitRule, RateLimiterService } from '../common/rate-limiter.service';
import { InvitationsService } from '../invitations/invitations.service';

type Tx = Prisma.TransactionClient;

/** Caps invitation volume per organization (abuse/spam once invitations are emailed). */
const INVITES_PER_ORG: RateLimitRule = { limit: 100, windowSeconds: 60 * 60 };

const memberSelect = {
  status: true,
  createdAt: true,
  user: {
    select: { id: true, name: true, email: true, status: true, emailVerifiedAt: true, lastLoginAt: true },
  },
  roles: rolesWithPermissionsSelect,
  departmentMemberships: { select: { department: { select: { id: true, name: true } } } },
  teamMemberships: { select: { team: { select: { id: true, name: true } } } },
} satisfies Prisma.UserOrganizationSelect;

type MemberRow = Prisma.UserOrganizationGetPayload<{ select: typeof memberSelect }>;

function effectiveStatus(row: MemberRow): MemberStatus {
  if (row.status === 'SUSPENDED') return 'SUSPENDED';
  if (row.user.status === 'SUSPENDED' || row.user.status === 'DEACTIVATED') return row.user.status;
  return row.status === 'INVITED' || row.user.status === 'INVITED' ? 'INVITED' : 'ACTIVE';
}

function denied(verdict: ManagementVerdict): void {
  if (!verdict.allowed) {
    throw new ApiException(verdict.reason, MANAGEMENT_DENIAL_MESSAGES[verdict.reason], HttpStatus.FORBIDDEN);
  }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * Member administration within the caller's organization. Every query is scoped by
 * auth.organizationId (from the session); a user ID from another organization is simply
 * "not found".
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly invitations: InvitationsService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async list(auth: AuthContext): Promise<MemberSummary[]> {
    const rows = await this.prisma.userOrganization.findMany({
      where: { organizationId: auth.organizationId },
      select: memberSelect,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toSummary(row, auth));
  }

  async get(auth: AuthContext, userId: string): Promise<MemberSummary> {
    return this.toSummary(await this.loadMember(this.prisma, auth.organizationId, userId), auth);
  }

  async invite(auth: AuthContext, input: InviteMemberInput): Promise<InviteMemberResponse> {
    await this.rateLimiter.consume(`invite:org:${auth.organizationId}`, INVITES_PER_ORG);
    const [role] = await this.loadRoles(auth.organizationId, [input.roleKey]);
    if (!role) throw notFound('role');
    denied(canGrantRoles(auth.permissions, [role]));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, name: input.name, status: 'INVITED' },
          select: { id: true },
        });
        await tx.userOrganization.create({
          data: { userId: user.id, organizationId: auth.organizationId, status: 'INVITED' },
        });
        await tx.userRole.create({
          data: { userId: user.id, organizationId: auth.organizationId, roleId: role.id },
        });
        const invitation = await this.invitations.issue(tx, {
          userId: user.id,
          organizationId: auth.organizationId,
          invitedById: auth.userId,
        });
        const member = this.toSummary(await this.loadMember(tx, auth.organizationId, user.id), auth);
        return { member, invitation };
      });
    } catch (error) {
      if (isUniqueViolation(error, 'email')) {
        // MVP: one organization per user, so an existing account cannot be invited.
        throw new ApiException(
          'EMAIL_UNAVAILABLE',
          'This email address already has a KnowGuard account.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async reissueInvitation(auth: AuthContext, userId: string): Promise<InvitationGrant> {
    return this.prisma.$transaction(async (tx) => {
      const target = await this.loadMember(tx, auth.organizationId, userId);
      this.assertCanManage(auth, target);
      if (effectiveStatus(target) !== 'INVITED') {
        throw new ApiException(
          'NOT_INVITED',
          'Only members who have not accepted their invitation can get a new link.',
          HttpStatus.CONFLICT,
        );
      }
      return this.invitations.issue(tx, {
        userId,
        organizationId: auth.organizationId,
        invitedById: auth.userId,
      });
    });
  }

  /** Suspends the membership and signs the member out everywhere in this organization. */
  async suspend(auth: AuthContext, userId: string): Promise<MemberSummary> {
    const row = await this.prisma.$transaction(async (tx) => {
      const target = await this.loadMember(tx, auth.organizationId, userId);
      this.assertCanManage(auth, target);
      if (target.status === 'SUSPENDED') return target;

      await tx.userOrganization.update({
        where: { userId_organizationId: { userId, organizationId: auth.organizationId } },
        data: { status: 'SUSPENDED' },
      });
      await this.invitations.revokeOutstanding(tx, userId, auth.organizationId);
      await this.sessions.revokeAllForMembership(tx, userId, auth.organizationId, 'membership_suspended');
      await assertOwnershipRemains(tx, auth.organizationId);
      return this.loadMember(tx, auth.organizationId, userId);
    });
    return this.toSummary(row, auth);
  }

  /** Restores a suspended membership: ACTIVE if they had set a password, otherwise INVITED. */
  async reactivate(auth: AuthContext, userId: string): Promise<MemberSummary> {
    const row = await this.prisma.$transaction(async (tx) => {
      const target = await this.loadMember(tx, auth.organizationId, userId);
      this.assertCanManage(auth, target);
      if (target.status !== 'SUSPENDED') return target;

      const account = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordHash: true },
      });
      await tx.userOrganization.update({
        where: { userId_organizationId: { userId, organizationId: auth.organizationId } },
        data: { status: account.passwordHash ? 'ACTIVE' : 'INVITED' },
      });
      return this.loadMember(tx, auth.organizationId, userId);
    });
    return this.toSummary(row, auth);
  }

  /**
   * Replaces the member's roles. New permissions apply on the member's next request, because
   * permissions are loaded with the session each time.
   */
  async setRoles(auth: AuthContext, userId: string, roleKeys: string[]): Promise<MemberSummary> {
    const roles = await this.loadRoles(auth.organizationId, roleKeys);
    denied(canGrantRoles(auth.permissions, roles));

    const row = await this.prisma.$transaction(async (tx) => {
      const target = await this.loadMember(tx, auth.organizationId, userId);
      this.assertCanManage(auth, target);

      await tx.userRole.deleteMany({ where: { userId, organizationId: auth.organizationId } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId, organizationId: auth.organizationId, roleId: role.id })),
      });
      await assertOwnershipRemains(tx, auth.organizationId);
      return this.loadMember(tx, auth.organizationId, userId);
    });
    return this.toSummary(row, auth);
  }

  // ── helpers ────────────────────────────────────────────────────────────────────────────

  private async loadMember(
    db: PrismaService | Tx,
    organizationId: string,
    userId: string,
  ): Promise<MemberRow> {
    const row = await db.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: memberSelect,
    });
    if (!row) throw notFound('member');
    return row;
  }

  /** All requested roles must exist in THIS organization; otherwise the whole request fails. */
  private async loadRoles(organizationId: string, keys: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { organizationId, key: { in: keys } },
      select: { id: true, key: true, permissions: { select: { permission: { select: { key: true } } } } },
    });
    if (roles.length !== new Set(keys).size) throw notFound('role');
    return roles.map((role) => ({
      id: role.id,
      permissions: role.permissions.map((grant) => grant.permission.key),
    }));
  }

  private assertCanManage(auth: AuthContext, target: MemberRow): void {
    denied(
      canManageMember(
        { userId: auth.userId, permissions: auth.permissions },
        { userId: target.user.id, permissions: permissionsOf(target.roles) },
      ),
    );
  }

  private toSummary(row: MemberRow, auth: AuthContext): MemberSummary {
    const manageable = canManageMember(
      { userId: auth.userId, permissions: auth.permissions },
      { userId: row.user.id, permissions: permissionsOf(row.roles) },
    ).allowed;
    return {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      status: effectiveStatus(row),
      emailVerified: row.user.emailVerifiedAt !== null,
      roles: roleKeysOf(row.roles),
      departments: row.departmentMemberships.map((m) => m.department).sort(byName),
      teams: row.teamMemberships.map((m) => m.team).sort(byName),
      joinedAt: row.createdAt.toISOString(),
      lastLoginAt: row.user.lastLoginAt?.toISOString() ?? null,
      manageable,
    };
  }
}
