import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { OrganizationDetails } from '@knowguard/types';
import { type UpdateOrganizationInput, updateOrganizationSchema } from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrganizationsService } from './organizations.service';

/**
 * The CALLER's organization only. There is deliberately no /organizations/:id route: the
 * organization is always the session's, never chosen by the client.
 */
@Controller('organization')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermission('organization.read')
  get(@CurrentAuth() auth: AuthContext): Promise<OrganizationDetails> {
    return this.organizations.details(auth.organizationId);
  }

  @Patch()
  @RequirePermission('organization.update')
  update(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationInput,
  ): Promise<OrganizationDetails> {
    return this.organizations.rename(auth.organizationId, body.name);
  }
}
