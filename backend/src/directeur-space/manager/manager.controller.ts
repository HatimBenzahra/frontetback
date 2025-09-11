import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ManagerService } from './manager.service';
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

@Controller('directeur-space/managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('directeur')
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  @Get()
  async getMyManagers(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.managerService.getDirecteurManagers(directeurId);
  }

  @Get(':managerId')
  async getMyManager(
    @Param('managerId') managerId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.managerService.getDirecteurManager(directeurId, managerId);
  }

  @Get('access/:managerId')
  async verifyManagerAccess(
    @Param('managerId') managerId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.managerService.getDirecteurManager(directeurId, managerId);
  }

  @Get(':managerId/equipes')
  async getManagerEquipes(
    @Param('managerId') managerId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.managerService.getDirecteurManagerEquipes(directeurId, managerId);
  }

  @Get(':managerId/commerciaux')
  async getManagerCommerciaux(
    @Param('managerId') managerId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.managerService.getDirecteurManagerCommerciaux(directeurId, managerId);
  }

  @Get(':managerId/stats')
  async getManagerStats(
    @Param('managerId') managerId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.managerService.getDirecteurManagerStats(directeurId, managerId);
  }

  @Get(':managerId/performance-history')
  async getManagerPerformanceHistory(
    @Param('managerId') managerId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.managerService.getDirecteurManagerPerformanceHistory(directeurId, managerId);
  }
}


