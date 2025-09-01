import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EquipeService } from './equipe.service';
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

@Controller('manager-space/equipes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Get()
  async getMyEquipes(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.equipeService.getManagerEquipes(managerId);
  }

  @Get(':equipeId')
  async getMyEquipe(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.equipeService.getManagerEquipe(managerId, equipeId);
  }

  @Get('access/:equipeId')
  async verifyEquipeAccess(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    const hasAccess = await this.equipeService.verifyManagerTeamAccess(managerId, equipeId);
    return { hasAccess };
  }
}