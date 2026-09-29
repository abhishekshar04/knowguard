import { Controller, Get } from '@nestjs/common';
import type { RoleListResponse } from '@knowguard/types';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { isSubset } from '../authorization/management-policy';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PrismaService } from '../common/prisma.service';

/** Read-only in Phase 3; custom role management (role.create/update/delete) is Phase 4. */
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('role.read')
  async list(@CurrentAuth() auth: AuthContext): Promise<RoleListResponse> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
    });
    return {
      roles: roles.map((role) => {
        const permissions = role.permissions.map((grant) => grant.permission.key).sort();
        return {
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions,
          memberCount: role._count.users,
          assignable: isSubset(permissions, auth.permissions),
        };
      }),
    };
  }
}
