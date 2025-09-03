import { Controller, Get, Query, Param, Post, Body, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { PeriodType, StatEntityType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager' , 'commercial')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Post('commercial/trigger-history-update')
  triggerHistoryUpdate(@Body() body: { commercialId: string, immeubleId: string }) {
    return this.statisticsService.triggerHistoryUpdate(body.commercialId, body.immeubleId);
  }

  @Get('commercial/:id/history')
  getCommercialHistory(@Param('id') id: string) {
    return this.statisticsService.getProspectingHistoryForCommercial(id);
  }

  @Get('commercial/:id')
  getCommercialStats(@Param('id') id: string) {
    return this.statisticsService.getStatsForCommercial(id);
  }

  @Get('manager/:id')
  getManagerStats(@Param('id') id: string) {
    return this.statisticsService.getStatsForManager(id);
  }

  @Get('manager/:id/history')
  getManagerPerformanceHistory(@Param('id') id: string) {
    return this.statisticsService.getManagerPerformanceHistory(id);
  }

  @Get('dashboard')
  getDashboardStats(@Query('period') period?: string) {
    return this.statisticsService.getDashboardStats(period);
  }

  @Get('global-performance-chart')
  getGlobalPerformanceChart(@Query('period') period?: string) {
    return this.statisticsService.getGlobalPerformanceChart(period);
  }

  @Get('repassage-chart')
  getRepassageChart(@Query('period') period?: string) {
    return this.statisticsService.getRepassageChart(period);
  }

  @Get('commercials-progress')
  getCommercialsProgress(@Query('period') period?: string) {
    return this.statisticsService.getCommercialsProgress(period);
  }

  @Get()
  getStatistics(
    @Query('period') period: PeriodType,
    @Query('entityType') entityType?: StatEntityType,
    @Query('entityId') entityId?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.statisticsService.getStatistics(period, entityType, entityId, zoneId);
  }
}
