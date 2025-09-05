import { Module } from '@nestjs/common';
import { ManagerStatisticsService } from './manager-statistics.service';
import { ManagerStatisticsController } from './manager-statistics.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ManagerSpaceService } from '../manager-space.service';

@Module({
  imports: [PrismaModule],
  controllers: [ManagerStatisticsController],
  providers: [ManagerStatisticsService, ManagerSpaceService],
  exports: [ManagerStatisticsService],
})
export class ManagerStatisticsModule {}
