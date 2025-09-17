import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssignmentGoalsModule } from '../../assignment-goals/assignment-goals.module';
import { DirecteurSpaceService } from '../directeur-space.service';
import { DirecteurStatisticsController } from './directeur-statistics.controller';
import { DirecteurStatisticsService } from './directeur-statistics.service';

@Module({
  imports: [PrismaModule, AssignmentGoalsModule],
  controllers: [DirecteurStatisticsController],
  providers: [DirecteurStatisticsService, DirecteurSpaceService],
  exports: [DirecteurStatisticsService],
})
export class DirecteurStatisticsModule {}


