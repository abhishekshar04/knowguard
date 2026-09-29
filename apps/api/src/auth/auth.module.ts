import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { OrganizationsModule } from '../organizations/organizations.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionService } from './session.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    // Authentication is on for every route in the app; opt out explicitly with @Public().
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
