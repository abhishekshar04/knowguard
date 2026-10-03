import { Controller, Get, Header, Query } from '@nestjs/common';
import type { AnalyticsOverview, AuditLogPage } from '@knowguard/types';
import {
  type AnalyticsQuery,
  analyticsQuerySchema,
  type AuditQuery,
  auditQuerySchema,
} from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';
import { AuditLogService } from './audit-log.service';

@Controller()
@RequirePermission('audit.read')
export class AuditController {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Newest first; filter by action, result, resource, user or time; page with `cursor`. */
  @Get('audit-logs')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
  ): Promise<AuditLogPage> {
    return this.auditLog.list(auth, query);
  }

  @Get('analytics/overview')
  @Header('Cache-Control', 'no-store')
  overview(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<AnalyticsOverview> {
    return this.analytics.overview(auth, query.days);
  }
}
