import { HttpStatus, Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@knowguard/authorization';
import type { Prisma } from '@knowguard/database';
import type { PermissionInfo, RoleSummary } from '@knowguard/types';
import { type CreateRoleInput, roleKeyFromName, type UpdateRoleInput } from '@knowguard/validation';

import { actorOf, AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { canGrantRoles, isSubset, MANAGEMENT_DENIAL_MESSAGES } from '../authorization/management-policy';
import { assertOwnershipRemains } from '../authorization/ownership';
import { ApiException, notFound } from '../common/api-exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';

const roleSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: { select: { permission: { select: { key: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

const exceedsYourAccess = (): ApiException =>
  new ApiException(
    'ROLE_EXCEEDS_YOUR_ACCESS',
    MANAGEMENT_DENIAL_MESSAGES.ROLE_EXCEEDS_YOUR_ACCESS,
    HttpStatus.FORBIDDEN,
  );

/**
 * Roles of the caller's organization. System roles (OWNER, ADMIN, MANAGER, EMPLOYEE) are
 * immutable; custom roles can be created, edited and deleted without privilege escalation:
 *  - a role may only contain permissions the caller holds (create and update);
 *  - a role the caller cannot fully see (it has permissions they lack) cannot be changed;
 *  - a role the caller holds cannot be changed (no self-escalation or self-lockout);
 *  - the organization must keep an active owner afterwards.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPermissions(): PermissionInfo[] {
    return Object.entries(PERMISSIONS).map(([key, description]) => ({
      key,
      description,
      group: key.split('.')[0] ?? key,
    }));
  }

  async list(auth: AuthContext): Promise<RoleSummary[]> {
    const rows = await this.prisma.role.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      select: roleSelect,
    });
    return rows.map((row) => this.toSummary(row, auth));
  }

  async create(auth: AuthContext, input: CreateRoleInput): Promise<RoleSummary> {
    if (!canGrantRoles(auth.permissions, [{ permissions: input.permissions }]).allowed) {
      throw exceedsYourAccess();
    }
    const permissionIds = await this.permissionIds(input.permissions);
    try {
      const row = await this.prisma.role.create({
        data: {
          organizationId: auth.organizationId,
          key: roleKeyFromName(input.name),
          name: input.name,
          description: input.description ?? null,
          isSystem: false,
          permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        },
        select: roleSelect,
      });
      await this.audit.record({
        actor: actorOf(auth),
        action: 'PERMISSION_CHANGE',
        resourceType: 'ROLE',
        resourceId: row.id,
        metadata: { change: 'ROLE_CREATED', role: row.key, after: this.keys(row) },
      });
      return this.toSummary(row, auth);
    } catch (error) {
      if (isUniqueViolation(error)) throw this.nameTaken();
      throw error;
    }
  }

  async update(auth: AuthContext, id: string, input: UpdateRoleInput): Promise<RoleSummary> {
    if (input.permissions && !isSubset(input.permissions, auth.permissions)) throw exceedsYourAccess();
    const permissionIds = input.permissions ? await this.permissionIds(input.permissions) : null;

    let before: string[] = [];
    const row = await this.prisma.$transaction(async (tx) => {
      const role = await this.loadEditable(tx, auth, id);
      before = this.keys(role);
      await tx.role.update({
        where: { id_organizationId: { id: role.id, organizationId: auth.organizationId } },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        });
        await assertOwnershipRemains(tx, auth.organizationId);
      }
      return tx.role.findUniqueOrThrow({ where: { id: role.id }, select: roleSelect });
    });
    const after = this.keys(row);
    await this.audit.record({
      actor: actorOf(auth),
      action: 'PERMISSION_CHANGE',
      resourceType: 'ROLE',
      resourceId: row.id,
      metadata: {
        change: 'ROLE_UPDATED',
        role: row.key,
        fields: Object.keys(input),
        added: after.filter((key) => !before.includes(key)),
        removed: before.filter((key) => !after.includes(key)),
      },
    });
    return this.toSummary(row, auth);
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const removed = await this.prisma.$transaction(async (tx) => {
      const role = await this.loadEditable(tx, auth, id);
      if (role._count.users > 0) {
        throw new ApiException(
          'ROLE_IN_USE',
          'Reassign the members who hold this role before deleting it.',
          HttpStatus.CONFLICT,
        );
      }
      await tx.documentPermission.deleteMany({
        where: { organizationId: auth.organizationId, subjectType: 'ROLE', subjectId: role.id },
      });
      await tx.documentAudience.deleteMany({
        where: { organizationId: auth.organizationId, targetId: role.id },
      });
      await tx.role.delete({ where: { id: role.id } });
      return role;
    });
    await this.audit.record({
      actor: actorOf(auth),
      action: 'PERMISSION_CHANGE',
      resourceType: 'ROLE',
      resourceId: removed.id,
      metadata: { change: 'ROLE_DELETED', role: removed.key, before: this.keys(removed) },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────────────────

  private async loadEditable(tx: Prisma.TransactionClient, auth: AuthContext, id: string): Promise<RoleRow> {
    const role = await tx.role.findUnique({
      where: { id_organizationId: { id, organizationId: auth.organizationId } },
      select: roleSelect,
    });
    if (!role) throw notFound('role');
    if (role.isSystem) {
      throw new ApiException(
        'SYSTEM_ROLE_IMMUTABLE',
        'Built-in roles cannot be changed. Create a custom role instead.',
        HttpStatus.CONFLICT,
      );
    }
    if (auth.roleIds.has(role.id)) {
      throw new ApiException('SELF', 'You cannot change a role you hold.', HttpStatus.FORBIDDEN);
    }
    if (!isSubset(this.keys(role), auth.permissions)) {
      throw new ApiException(
        'TARGET_HAS_MORE_ACCESS',
        'You cannot change a role that has access you do not have.',
        HttpStatus.FORBIDDEN,
      );
    }
    return role;
  }

  private async permissionIds(keys: readonly string[]): Promise<string[]> {
    const rows = await this.prisma.permission.findMany({
      where: { key: { in: [...keys] } },
      select: { id: true },
    });
    if (rows.length !== keys.length) throw new Error('Permission catalog out of sync with the database');
    return rows.map((row) => row.id);
  }

  private keys(row: RoleRow): string[] {
    return row.permissions.map((grant) => grant.permission.key).sort();
  }

  private nameTaken(): ApiException {
    return new ApiException(
      'NAME_TAKEN',
      'A role with this name already exists (names must differ from built-in roles too).',
      HttpStatus.CONFLICT,
    );
  }

  private toSummary(row: RoleRow, auth: AuthContext): RoleSummary {
    const permissions = this.keys(row);
    const withinAccess = isSubset(permissions, auth.permissions);
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      permissions,
      memberCount: row._count.users,
      assignable: withinAccess,
      editable: !row.isSystem && withinAccess && !auth.roleIds.has(row.id),
    };
  }
}
