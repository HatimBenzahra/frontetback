import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { ManagerAssignmentGoalsService } from './assignment-goals.service';
import { ManagerAssignmentGoalsController } from './assignment-goals.controller';
import { ManagerAssignmentSchedulerService } from './manager-assignment-scheduler.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ManagerAssignmentGoalsController],
  providers: [ManagerAssignmentGoalsService], // ManagerAssignmentSchedulerService temporairement désactivé
  exports: [ManagerAssignmentGoalsService], // ManagerAssignmentSchedulerService temporairement désactivé
})
export class ManagerAssignmentGoalsModule {}
