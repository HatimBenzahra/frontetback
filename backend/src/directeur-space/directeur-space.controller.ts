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
}