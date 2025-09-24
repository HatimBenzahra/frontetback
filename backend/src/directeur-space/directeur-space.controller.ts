import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DirecteurSpaceService } from './directeur-space.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AssignmentType } from '@prisma/client';

interface AuthRequest extends Request {
  user: {
    directeurId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller('directeur-space')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('directeur')
export class DirecteurSpaceController {
  constructor(private readonly directeurSpaceService: DirecteurSpaceService) {}

  @Get('global-goal')
  async getCurrentGlobalGoal() {
    return this.directeurSpaceService.getCurrentGlobalGoal();
  }

  @Post('global-goal')
  async setGlobalGoal(
    @Body() body: { goal: number; startDate?: Date; durationMonths?: number }
  ) {
    return this.directeurSpaceService.setGlobalGoal(
      body.goal,
      body.startDate,
      body.durationMonths
    );
  }

  @Get('assignments/history')
  async getAssignmentHistory(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.getDirecteurAssignmentHistory(directeurId);
  }

  @Get('assignments/status')
  async getAssignmentsWithStatus(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.getDirecteurAssignmentsWithStatus(directeurId);
  }

  // === ENDPOINTS POUR LES ASSIGNATIONS DE ZONES ===

  @Post('assign-zone')
  async assignZoneToDirecteur(
    @Request() req: AuthRequest,
    @Body('zoneId') zoneId: string,
    @Body('assigneeId') assigneeId: string,
    @Body('assignmentType') assignmentType: AssignmentType,
    @Body('startDate') startDate?: string,
    @Body('durationDays') durationDays?: number,
  ) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.assignZoneToDirecteur(
      directeurId,
      zoneId,
      assigneeId,
      assignmentType,
      startDate ? new Date(startDate) : undefined,
      durationDays,
      req.user.userId,
      req.user.preferredUsername,
    );
  }

  @Get('assignments/status-all')
  async getAllAssignmentsWithStatusForDirecteur(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.getAllAssignmentsWithStatusForDirecteur(directeurId);
  }
}