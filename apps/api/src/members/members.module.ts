import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [AuthModule, InvitationsModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
