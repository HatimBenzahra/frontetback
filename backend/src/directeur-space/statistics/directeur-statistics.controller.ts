import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DirecteurStatisticsService } from './directeur-statistics.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

interface AuthRequest extends Request {
  user: {
    directeurId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller('directeur-space/statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('directeur')
export class DirecteurStatisticsController {
  constructor(private readonly statisticsService: DirecteurStatisticsService) {}

  @Get('global')
  async getGlobalStats(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.statisticsService.getDirecteurGlobalStats(directeurId);
  }

  @Get('managers')
  async getManagersStats(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.statisticsService.getDirecteurManagersStats(directeurId);
  }

  @Get('equipes')
  async getEquipesStats(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.statisticsService.getDirecteurEquipesStats(directeurId);
  }

  @Get('commerciaux')
  async getCommerciauxStats(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.statisticsService.getDirecteurCommerciauxStats(directeurId);
  }

  @Get('performance-history')
  async getPerformanceHistory(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.statisticsService.getDirecteurPerformanceHistory(directeurId);
  }
}


