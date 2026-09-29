import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { InvitationPreview, SessionGrant } from '@knowguard/types';
import { type AcceptInvitationInput, acceptInvitationSchema } from '@knowguard/validation';
import type { Request } from 'express';

import { Public } from '../auth/auth.decorators';
import { requestMeta } from '../common/request-meta';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InvitationsService } from './invitations.service';

/** Public: the invitee has no session yet. Possession of the one-time token is the credential. */
@Public()
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  preview(@Param('token') token: string, @Req() req: Request): Promise<InvitationPreview> {
    return this.invitations.preview(token, requestMeta(req));
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  accept(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationInput,
    @Req() req: Request,
  ): Promise<SessionGrant> {
    return this.invitations.accept(token, body, requestMeta(req));
  }
}
