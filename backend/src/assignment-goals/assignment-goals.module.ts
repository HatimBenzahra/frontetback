import { Module } from '@nestjs/common';
import { AssignmentGoalsService } from './assignment-goals.service';
import { AssignmentGoalsController } from './assignment-goals.controller';
import { AssignmentSchedulerService } from './assignment-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AssignmentGoalsController],
  providers: [AssignmentGoalsService], // AssignmentSchedulerService temporairement désactivé
  exports: [AssignmentGoalsService], // Export du service pour les autres modules
})
export class AssignmentGoalsModule {}
