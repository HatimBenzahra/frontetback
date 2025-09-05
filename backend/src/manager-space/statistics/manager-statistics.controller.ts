import { Controller, Get, Query, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ManagerStatisticsService } from './manager-statistics.service';
import { PeriodType, StatEntityType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('manager-space/statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ManagerStatisticsController {
  constructor(private readonly managerStatisticsService: ManagerStatisticsService) {}

  @Get()
  getManagerStatistics(
    @Request() req: any,
    @Query('period') period: PeriodType,
    @Query('entityType') entityType?: StatEntityType,
    @Query('entityId') entityId?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    // Validation des paramètres
    if (!period || !Object.values(PeriodType).includes(period)) {
      throw new BadRequestException('Invalid period parameter');
    }
    
    if (entityType && !Object.values(StatEntityType).includes(entityType)) {
      throw new BadRequestException('Invalid entityType parameter');
    }
    
    if (entityType && !entityId) {
      throw new BadRequestException('entityId is required when entityType is specified');
    }
    
    if (!req.user?.sub) {
      throw new BadRequestException('Manager ID not found in token');
    }

    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerStatistics(
      managerId,
      period,
      entityType,
      entityId,
      zoneId,
    );
  }

  @Get('dashboard')
  getManagerDashboardStats(@Request() req: any, @Query('period') period?: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerDashboardStats(managerId, period);
  }

  @Get('performance-history')
  getManagerPerformanceHistory(@Request() req: any, @Query('period') period?: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerPerformanceHistory(managerId, period);
  }

  @Get('commercials-progress')
  getManagerCommercialsProgress(@Request() req: any, @Query('period') period?: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerCommercialsProgress(managerId, period);
  }

  @Get('commercial/:id')
  getManagerCommercialStats(@Request() req: any, @Param('id') commercialId: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerCommercialStats(managerId, commercialId);
  }

  @Get('commercial/:id/history')
  getManagerCommercialHistory(@Request() req: any, @Param('id') commercialId: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerCommercialHistory(managerId, commercialId);
  }

  @Get('equipe/:id')
  getManagerEquipeStats(@Request() req: any, @Param('id') equipeId: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerEquipeStats(managerId, equipeId);
  }

  @Get('global-performance-chart')
  getManagerGlobalPerformanceChart(@Request() req: any, @Query('period') period?: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerGlobalPerformanceChart(managerId, period);
  }

  @Get('repassage-chart')
  getManagerRepassageChart(@Request() req: any, @Query('period') period?: string) {
    const managerId = req.user.sub; // Get manager ID from JWT token
    return this.managerStatisticsService.getManagerRepassageChart(managerId, period);
  }
}
