import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EquipeService } from './equipe.service';
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

@Controller('directeur-space/equipes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('directeur')
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Get()
  async getMyEquipes(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.getDirecteurEquipes(directeurId);
  }

  @Get(':equipeId')
  async getMyEquipe(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.getDirecteurEquipe(directeurId, equipeId);
  }

  @Get('access/:equipeId')
  async verifyEquipeAccess(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.getDirecteurEquipe(directeurId, equipeId);
  }

  @Get(':equipeId/commerciaux')
  async getEquipeCommerciaux(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.getDirecteurEquipeCommerciaux(directeurId, equipeId);
  }

  @Get(':equipeId/stats')
  async getEquipeStats(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.getDirecteurEquipeStats(directeurId, equipeId);
  }

  @Get(':equipeId/performance-history')
  async getEquipePerformanceHistory(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.getDirecteurEquipePerformanceHistory(directeurId, equipeId);
  }

  @Post(':equipeId/commerciaux/:commercialId')
  async addCommercialToEquipe(
    @Param('equipeId') equipeId: string,
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.addCommercialToEquipe(directeurId, equipeId, commercialId);
  }

  @Delete(':equipeId/commerciaux/:commercialId')
  async removeCommercialFromEquipe(
    @Param('equipeId') equipeId: string,
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.equipeService.removeCommercialFromEquipe(directeurId, equipeId, commercialId);
  }
}

