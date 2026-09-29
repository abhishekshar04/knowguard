import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import type { PermissionListResponse, RoleListResponse, RoleSummary } from '@knowguard/types';
import {
  type CreateRoleInput,
  createRoleSchema,
  type UpdateRoleInput,
  updateRoleSchema,
} from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RolesService } from './roles.service';

const roleId = new ParseIdPipe('role');

@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** The permission catalog, for the role editor. */
  @Get('permissions')
  @RequirePermission('role.read')
  permissions(): PermissionListResponse {
    return { permissions: this.roles.listPermissions() };
  }

  @Get('roles')
  @RequirePermission('role.read')
  async list(@CurrentAuth() auth: AuthContext): Promise<RoleListResponse> {
    return { roles: await this.roles.list(auth) };
  }

  @Post('roles')
  @RequirePermission('role.create')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createRoleSchema)) body: CreateRoleInput,
  ): Promise<RoleSummary> {
    return this.roles.create(auth, body);
  }

  @Patch('roles/:id')
  @RequirePermission('role.update')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', roleId) id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: UpdateRoleInput,
  ): Promise<RoleSummary> {
    return this.roles.update(auth, id, body);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('role.delete')
  async remove(@CurrentAuth() auth: AuthContext, @Param('id', roleId) id: string): Promise<void> {
    await this.roles.remove(auth, id);
  }
}
