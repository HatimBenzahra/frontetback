import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ManagerSpaceService } from './manager-space.service';
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

@Controller('manager-space')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ManagerSpaceController {
  constructor(private readonly managerSpaceService: ManagerSpaceService) {}

  // Récupérer les commerciaux du manager connecté
  @Get('commerciaux')
  async getMyCommerciaux(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerCommerciaux(managerId);
  }

  // Récupérer les équipes du manager connecté
  @Get('equipes')
  async getMyEquipes(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerEquipes(managerId);
  }

  // Récupérer un commercial spécifique du manager connecté
  @Get('commerciaux/:commercialId')
  async getMyCommercial(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerCommercial(managerId, commercialId);
  }

  // Récupérer une équipe spécifique du manager connecté
  @Get('equipes/:equipeId')
  async getMyEquipe(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerEquipe(managerId, equipeId);
  }

  // Récupérer les zones du manager connecté
  @Get('zones')
  async getMyZones(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerZones(managerId);
  }

  // Récupérer les immeubles des commerciaux du manager connecté
  @Get('immeubles')
  async getMyImmeubles(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerImmeubles(managerId);
  }

  // Récupérer un immeuble spécifique des commerciaux du manager connecté
  @Get('immeubles/:immeubleId')
  async getMyImmeuble(
    @Param('immeubleId') immeubleId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerImmeuble(managerId, immeubleId);
  }

  // Supprimer un immeuble des commerciaux du manager connecté
  @Delete('immeubles/:immeubleId')
  async deleteMyImmeuble(
    @Param('immeubleId') immeubleId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.deleteManagerImmeuble(managerId, immeubleId);
  }

  // Route pour vérifier l'accès à un commercial (utilitaire)
  @Get('access/commercial/:commercialId')
  async verifyCommercialAccess(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    const hasAccess = await this.managerSpaceService.verifyManagerAccess(managerId, commercialId);
    return { hasAccess };
  }

  // Route pour vérifier l'accès à une équipe (utilitaire)
  @Get('access/equipe/:equipeId')
  async verifyEquipeAccess(
    @Param('equipeId') equipeId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    const hasAccess = await this.managerSpaceService.verifyManagerTeamAccess(managerId, equipeId);
    return { hasAccess };
  }

  // Récupérer tous les historiques de prospection des commerciaux du manager (page suivi)
  @Get('suivi')
  async getSuiviProspection(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerHistoriques(managerId);
  }

  // Récupérer les historiques d'un commercial spécifique (pour le suivi détaillé)
  @Get('suivi/commercial/:commercialId')
  async getSuiviCommercial(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getCommercialHistoriques(managerId, commercialId);
  }

  // Récupérer les transcriptions de tous les commerciaux du manager
  @Get('transcriptions')
  async getTranscriptions(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getManagerTranscriptions(managerId);
  }

  // Récupérer les transcriptions d'un commercial spécifique
  @Get('transcriptions/commercial/:commercialId')
  async getCommercialTranscriptions(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.managerSpaceService.getCommercialTranscriptions(managerId, commercialId);
  }
}