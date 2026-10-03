import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from '@nestjs/common';
import type { DepartmentDetails, DepartmentListResponse } from '@knowguard/types';
import {
  type CreateDepartmentInput,
  createDepartmentSchema,
  type UpdateDepartmentInput,
  updateDepartmentSchema,
} from '@knowguard/validation';

import { actorOf, AuditService } from '../audit/audit.service';
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
  constructor(
    private readonly structure: StructureService,
    private readonly audit: AuditService,
  ) {}

  /** Group changes alter who inherits access to department-visible documents: always audited. */
  private changed(auth: AuthContext, id: string, metadata: Record<string, unknown>): Promise<void> {
    return this.audit.record({
      actor: actorOf(auth),
      action: 'GROUP_CHANGED',
      resourceType: 'DEPARTMENT',
      resourceId: id,
      metadata,
    });
  }

  /** Organization structure is visible to every member (organization.read). */
  @Get()
  @RequirePermission('organization.read')
  async list(@CurrentAuth() auth: AuthContext): Promise<DepartmentListResponse> {
    return { departments: await this.structure.listDepartments(auth.organizationId) };
  }

  @Post()
  @RequirePermission('department.manage')
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentInput,
  ): Promise<DepartmentDetails> {
    const created = await this.structure.createDepartment(auth.organizationId, body);
    await this.changed(auth, created.id, { change: 'CREATED', name: created.name });
    return created;
  }

  @Patch(':id')
  @RequirePermission('department.manage')
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', departmentId) id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema)) body: UpdateDepartmentInput,
  ): Promise<DepartmentDetails> {
    const updated = await this.structure.updateDepartment(auth.organizationId, id, body);
    await this.changed(auth, id, { change: 'UPDATED', fields: Object.keys(body) });
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('department.manage')
  async remove(@CurrentAuth() auth: AuthContext, @Param('id', departmentId) id: string): Promise<void> {
    await this.structure.deleteDepartment(auth.organizationId, id);
    await this.changed(auth, id, { change: 'DELETED' });
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
    await this.changed(auth, id, { change: 'MEMBER_ADDED', userId });
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
    await this.changed(auth, id, { change: 'MEMBER_REMOVED', userId });
  }
}
