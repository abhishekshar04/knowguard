import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from '@nestjs/common';
import type { DepartmentDetails, DepartmentListResponse } from '@knowguard/types';
import {
  type CreateDepartmentInput,
  createDepartmentSchema,
  type UpdateDepartmentInput,
  updateDepartmentSchema,
} from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StructureService } from './structure.service';

const departmentId = new ParseIdPipe('department');
const memberId = new ParseIdPipe('member');

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly structure: StructureService) {}

  /** Organization structure is visible to every member (organization.read). */
  @Get()
  @RequirePermission('organization.read')
  async list(@CurrentAuth() auth: AuthContext): Promise<DepartmentListResponse> {
    return { departments: await this.structure.listDepartments(auth.organizationId) };
  }

  @Post()
  @RequirePermission('department.manage')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentInput,
  ): Promise<DepartmentDetails> {
    return this.structure.createDepartment(auth.organizationId, body);
  }

  @Patch(':id')
  @RequirePermission('department.manage')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', departmentId) id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema)) body: UpdateDepartmentInput,
  ): Promise<DepartmentDetails> {
    return this.structure.updateDepartment(auth.organizationId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('department.manage')
  async remove(@CurrentAuth() auth: AuthContext, @Param('id', departmentId) id: string): Promise<void> {
    await this.structure.deleteDepartment(auth.organizationId, id);
  }

  @Put(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('department.manage')
  async addMember(
    @CurrentAuth() auth: AuthContext,
    @Param('id', departmentId) id: string,
    @Param('userId', memberId) userId: string,
  ): Promise<void> {
    await this.structure.addDepartmentMember(auth.organizationId, id, userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('department.manage')
  async removeMember(
    @CurrentAuth() auth: AuthContext,
    @Param('id', departmentId) id: string,
    @Param('userId', memberId) userId: string,
  ): Promise<void> {
    await this.structure.removeDepartmentMember(auth.organizationId, id, userId);
  }
}
