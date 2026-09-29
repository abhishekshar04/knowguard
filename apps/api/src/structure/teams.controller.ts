import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from '@nestjs/common';
import type { TeamDetails, TeamListResponse } from '@knowguard/types';
import {
  type CreateTeamInput,
  createTeamSchema,
  type UpdateTeamInput,
  updateTeamSchema,
} from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StructureService } from './structure.service';

const teamId = new ParseIdPipe('team');
const memberId = new ParseIdPipe('member');

@Controller('teams')
export class TeamsController {
  constructor(private readonly structure: StructureService) {}

  @Get()
  @RequirePermission('organization.read')
  async list(@CurrentAuth() auth: AuthContext): Promise<TeamListResponse> {
    return { teams: await this.structure.listTeams(auth.organizationId) };
  }

  @Post()
  @RequirePermission('team.manage')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeamInput,
  ): Promise<TeamDetails> {
    return this.structure.createTeam(auth.organizationId, body);
  }

  @Patch(':id')
  @RequirePermission('team.manage')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', teamId) id: string,
    @Body(new ZodValidationPipe(updateTeamSchema)) body: UpdateTeamInput,
  ): Promise<TeamDetails> {
    return this.structure.updateTeam(auth.organizationId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('team.manage')
  async remove(@CurrentAuth() auth: AuthContext, @Param('id', teamId) id: string): Promise<void> {
    await this.structure.deleteTeam(auth.organizationId, id);
  }

  @Put(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('team.manage')
  async addMember(
    @CurrentAuth() auth: AuthContext,
    @Param('id', teamId) id: string,
    @Param('userId', memberId) userId: string,
  ): Promise<void> {
    await this.structure.addTeamMember(auth.organizationId, id, userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('team.manage')
  async removeMember(
    @CurrentAuth() auth: AuthContext,
    @Param('id', teamId) id: string,
    @Param('userId', memberId) userId: string,
  ): Promise<void> {
    await this.structure.removeTeamMember(auth.organizationId, id, userId);
  }
}
