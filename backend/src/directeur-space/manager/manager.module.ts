import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssignmentGoalsModule } from '../../assignment-goals/assignment-goals.module';
import { DirecteurSpaceService } from '../directeur-space.service';
import { ManagerController } from './manager.controller';
import { ManagerService } from './manager.service';

@Module({
  imports: [PrismaModule, AssignmentGoalsModule],
  controllers: [ManagerController],
  providers: [ManagerService, DirecteurSpaceService],
  exports: [ManagerService],
})
export class DirecteurManagerModule {}

