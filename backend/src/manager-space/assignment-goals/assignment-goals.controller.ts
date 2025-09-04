import { Controller, Post, Body, Get, Param, Query, Patch, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ManagerAssignmentGoalsService } from './assignment-goals.service';
import { AssignmentType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

interface AuthRequest extends Request {
  user: {
    managerId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller('manager-space/assignment-goals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ManagerAssignmentGoalsController {
  constructor(
    private readonly managerAssignmentGoalsService: ManagerAssignmentGoalsService,
  ) {}

  @Get('assignments')
  async getManagerAssignments(@Request() req: AuthRequest) {
    const { managerId } = req.user;
    return this.managerAssignmentGoalsService.getManagerAssignments(managerId);
  }

  @Get('history')
  async getManagerAssignmentHistory(@Request() req: AuthRequest) {
    const { managerId } = req.user;
    return this.managerAssignmentGoalsService.getManagerAssignmentHistory(managerId);
  }

  @Get('zones')
  async getManagerZones(@Request() req: AuthRequest) {
    const { managerId } = req.user;
    return this.managerAssignmentGoalsService.getManagerZones(managerId);
  }

  @Get('commercials')
  async getManagerCommercials(@Request() req: AuthRequest) {
    const { managerId } = req.user;
    return this.managerAssignmentGoalsService.getManagerCommercials(managerId);
  }

  @Get('equipes')
  async getManagerEquipes(@Request() req: AuthRequest) {
    const { managerId } = req.user;
    return this.managerAssignmentGoalsService.getManagerEquipes(managerId);
  }

  @Post('assign-zone')
  async assignZoneToManager(
    @Request() req: AuthRequest,
    @Body('zoneId') zoneId: string,
    @Body('assigneeId') assigneeId: string,
    @Body('assignmentType') assignmentType: AssignmentType,
    @Body('startDate') startDate?: string,
    @Body('durationDays') durationDays?: number,
    @Body('assignedByUserId') assignedByUserId?: string,
    @Body('assignedByUserName') assignedByUserName?: string,
  ) {
    const { managerId } = req.user;
    return this.managerAssignmentGoalsService.assignZoneToManager(
      managerId,
      zoneId,
      assigneeId,
      assignmentType,
      startDate ? new Date(startDate) : undefined,
      durationDays,
      assignedByUserId || req.user.userId,
      assignedByUserName || req.user.preferredUsername,
    );
  }

  @Patch('stop-assignment/:assignmentId')
  async stopManagerAssignment(
    @Request() req: AuthRequest,
    @Param('assignmentId') assignmentId: string
  ) {
    const { managerId } = req.user;
    return this.managerAssignmentGoalsService.stopManagerAssignment(managerId, assignmentId);
  }

}
