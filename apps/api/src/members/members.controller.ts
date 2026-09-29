import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import type {
  InvitationGrant,
  InviteMemberResponse,
  MemberListResponse,
  MemberSummary,
} from '@knowguard/types';
import {
  type InviteMemberInput,
  inviteMemberSchema,
  type UpdateMemberRolesInput,
  updateMemberRolesSchema,
} from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MembersService } from './members.service';

const memberId = new ParseIdPipe('member');

/** Members of the caller's organization. Route name follows the spec (/users). */
@Controller('users')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermission('user.read')
  async list(@CurrentAuth() auth: AuthContext): Promise<MemberListResponse> {
    return { members: await this.members.list(auth) };
  }

  @Get(':id')
  @RequirePermission('user.read')
  get(@CurrentAuth() auth: AuthContext, @Param('id', memberId) id: string): Promise<MemberSummary> {
    return this.members.get(auth, id);
  }

  @Post('invitations')
  @RequirePermission('user.create')
  @Header('Cache-Control', 'no-store')
  invite(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ): Promise<InviteMemberResponse> {
    return this.members.invite(auth, body);
  }

  @Post(':id/invitations')
  @RequirePermission('user.create')
  @Header('Cache-Control', 'no-store')
  reissueInvitation(
    @CurrentAuth() auth: AuthContext,
    @Param('id', memberId) id: string,
  ): Promise<InvitationGrant> {
    return this.members.reissueInvitation(auth, id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.update')
  suspend(@CurrentAuth() auth: AuthContext, @Param('id', memberId) id: string): Promise<MemberSummary> {
    return this.members.suspend(auth, id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.update')
  reactivate(@CurrentAuth() auth: AuthContext, @Param('id', memberId) id: string): Promise<MemberSummary> {
    return this.members.reactivate(auth, id);
  }

  @Put(':id/roles')
  @RequirePermission('role.update')
  setRoles(
    @CurrentAuth() auth: AuthContext,
    @Param('id', memberId) id: string,
    @Body(new ZodValidationPipe(updateMemberRolesSchema)) body: UpdateMemberRolesInput,
  ): Promise<MemberSummary> {
    return this.members.setRoles(auth, id, body.roleKeys);
  }
}
