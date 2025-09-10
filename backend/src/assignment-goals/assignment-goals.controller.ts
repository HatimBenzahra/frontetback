import { Controller, Post, Body, Get, Param, Query, Patch, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AssignmentGoalsService } from './assignment-goals.service';
import { AssignmentType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface AuthRequest extends Request {
  user: {
    managerId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller('assignment-goals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'commercial', 'directeur', 'backoffice')
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
    @Body('durationDays') durationDays?: number,
    @Body('assignedByUserId') assignedByUserId?: string,
    @Body('assignedByUserName') assignedByUserName?: string,
  ) {
    return this.assignmentGoalsService.assignZone(
      zoneId,
      assigneeId,
      assignmentType,
      startDate ? new Date(startDate) : undefined,
      durationDays,
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

  @Get('equipe/:equipeId/zones')
  getAssignedZonesForEquipe(@Param('equipeId') equipeId: string) {
    return this.assignmentGoalsService.getAssignedZonesForEquipe(equipeId);
  }

  @Get('zone/:zoneId/commercials')
  getCommercialsInZone(@Param('zoneId') zoneId: string) {
    return this.assignmentGoalsService.getCommercialsInZone(zoneId);
  }

  @Get('manager/:managerId/commercials')
  getCommercialsForManager(@Param('managerId') managerId: string) {
    return this.assignmentGoalsService.getCommercialsForManager(managerId);
  }

  @Get('equipe/:equipeId/commercials')
  getCommercialsForEquipe(@Param('equipeId') equipeId: string) {
    return this.assignmentGoalsService.getCommercialsForEquipe(equipeId);
  }

  @Get('commercial/:commercialId/summary')
  getCommercialAssignmentSummary(@Param('commercialId') commercialId: string) {
    return this.assignmentGoalsService.getCommercialAssignmentSummary(commercialId);
  }

  @Get('commercial/:commercialId/active-zone')
  getActiveZoneForCommercial(@Param('commercialId') commercialId: string) {
    return this.assignmentGoalsService.getActiveZoneForCommercial(commercialId);
  }

  @Get('admin/assignments-status')
  async getAllAssignmentsWithStatus(@Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    if (roles.includes('admin')) {
      // Admin voit toutes les assignations
      return this.assignmentGoalsService.getAllAssignmentsWithStatus();
    } 
    else if (roles.includes('manager')) {
      // Manager voit seulement les assignations de ses équipes/commerciaux
      return this.assignmentGoalsService.getAllAssignmentsWithStatusForManager(managerId);
    }
    else if (roles.includes('commercial')) {
      // Commercial voit toutes les assignations (pour informations générales)
      return this.assignmentGoalsService.getAllAssignmentsWithStatus();
    }
    else if (roles.includes('directeur')) {
      // Directeur voit toutes les assignations
      return this.assignmentGoalsService.getAllAssignmentsWithStatus();
    }
    else if (roles.includes('backoffice')) {
      // Backoffice voit toutes les assignations
      return this.assignmentGoalsService.getAllAssignmentsWithStatus();
    }
    
    throw new ForbiddenException('Access denied');
  }

  @Patch('stop-assignment/:assignmentId')
  stopAssignment(@Param('assignmentId') assignmentId: string) {
    return this.assignmentGoalsService.stopAssignment(assignmentId);
  }
}
