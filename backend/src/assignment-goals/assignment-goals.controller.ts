import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { AssignmentGoalsService } from './assignment-goals.service';
import { AssignmentType } from '@prisma/client';

@Controller('assignment-goals')
export class AssignmentGoalsController {
  constructor(
    private readonly assignmentGoalsService: AssignmentGoalsService,
  ) {}

  @Post('assign-zone')
  assignZone(
    @Body('zoneId') zoneId: string,
    @Body('assigneeId') assigneeId: string,
    @Body('assignmentType') assignmentType: AssignmentType,
    @Body('startDate') startDate?: string,
    @Body('durationMonths') durationMonths?: number,
    @Body('assignedByUserId') assignedByUserId?: string,
    @Body('assignedByUserName') assignedByUserName?: string,
  ) {
    return this.assignmentGoalsService.assignZone(
      zoneId,
      assigneeId,
      assignmentType,
      startDate ? new Date(startDate) : undefined,
      durationMonths,
      assignedByUserId,
      assignedByUserName,
    );
  }

  @Post('set-monthly-goal')
  setMonthlyGoal(
    @Body('commercialId') commercialId: string,
    @Body('goal') goal: number,
  ) {
    return this.assignmentGoalsService.setMonthlyGoal(commercialId, goal);
  }

  @Post('set-global-goal')
  setGlobalGoal(
    @Body('goal') goal: number,
    @Body('startDate') startDate?: string,
    @Body('durationMonths') durationMonths?: number,
  ) {
    return this.assignmentGoalsService.setGlobalGoal(
      goal,
      startDate ? new Date(startDate) : undefined,
      durationMonths,
    );
  }

  @Get('global-goal/current')
  getCurrentGlobalGoal() {
    return this.assignmentGoalsService.getCurrentGlobalGoal();
  }

  @Get('history')
  getAssignmentHistory(@Query('zoneId') zoneId?: string) {
    return this.assignmentGoalsService.getZoneAssignmentHistory(zoneId);
  }

  @Get('zone/:zoneId/history')
  getAssignmentHistoryForZone(@Param('zoneId') zoneId: string) {
    return this.assignmentGoalsService.getZoneAssignmentHistory(zoneId);
  }

  @Get('manager/:managerId/zones')
  getAssignedZonesForManager(@Param('managerId') managerId: string) {
    return this.assignmentGoalsService.getAssignedZonesForManager(managerId);
  }

  @Get('commercial/:commercialId/zones')
  getAssignedZonesForCommercial(@Param('commercialId') commercialId: string) {
    return this.assignmentGoalsService.getAssignedZonesForCommercial(
      commercialId,
    );
  }

  @Get('zone/:zoneId/commercials')
  getCommercialsInZone(@Param('zoneId') zoneId: string) {
    return this.assignmentGoalsService.getCommercialsInZone(zoneId);
  }
}
