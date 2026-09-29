import { Module } from '@nestjs/common';

import { DepartmentsController } from './departments.controller';
import { StructureService } from './structure.service';
import { TeamsController } from './teams.controller';

@Module({
  controllers: [DepartmentsController, TeamsController],
  providers: [StructureService],
})
export class StructureModule {}
