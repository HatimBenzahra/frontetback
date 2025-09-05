import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { ManagerAssignmentGoalsService } from './assignment-goals.service';
import { ManagerAssignmentGoalsController } from './assignment-goals.controller';
import { ManagerAssignmentSchedulerService } from './manager-assignment-scheduler.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ManagerAssignmentGoalsController],
  providers: [ManagerAssignmentGoalsService, ManagerAssignmentSchedulerService],
  exports: [ManagerAssignmentGoalsService, ManagerAssignmentSchedulerService],
})
export class ManagerAssignmentGoalsModule {}
