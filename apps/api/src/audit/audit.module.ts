import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AccessDeniedInterceptor } from './access-denied.interceptor';
import { AnalyticsService } from './analytics.service';
import { AuditLogService } from './audit-log.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/** Global so every feature module can record audit events. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditLogService,
    AnalyticsService,
    { provide: APP_INTERCEPTOR, useClass: AccessDeniedInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
