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

// TODO: Importer les guards d'authentification quand ils seront disponibles
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@Controller('manager-space')
// TODO: Décommenter ces guards quand l'authentification sera en place
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('manager')
export class ManagerSpaceController {
  constructor(private readonly managerSpaceService: ManagerSpaceService) {}

  // Récupérer les commerciaux du manager connecté
  @Get(':managerId/commerciaux')
  async getMyCommerciaux(
    @Param('managerId') managerId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only access your own commercials');
    // }
    
    return this.managerSpaceService.getManagerCommerciaux(managerId);
  }

  // Récupérer les équipes du manager connecté
  @Get(':managerId/equipes')
  async getMyEquipes(
    @Param('managerId') managerId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only access your own teams');
    // }
    
    return this.managerSpaceService.getManagerEquipes(managerId);
  }

  // Récupérer un commercial spécifique du manager connecté
  @Get(':managerId/commerciaux/:commercialId')
  async getMyCommercial(
    @Param('managerId') managerId: string,
    @Param('commercialId') commercialId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only access your own commercials');
    // }
    
    return this.managerSpaceService.getManagerCommercial(managerId, commercialId);
  }

  // Récupérer une équipe spécifique du manager connecté
  @Get(':managerId/equipes/:equipeId')
  async getMyEquipe(
    @Param('managerId') managerId: string,
    @Param('equipeId') equipeId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only access your own teams');
    // }
    
    return this.managerSpaceService.getManagerEquipe(managerId, equipeId);
  }

  // Récupérer les zones du manager connecté
  @Get(':managerId/zones')
  async getMyZones(
    @Param('managerId') managerId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only access your own zones');
    // }
    
    return this.managerSpaceService.getManagerZones(managerId);
  }

  // Récupérer les immeubles des commerciaux du manager connecté
  @Get(':managerId/immeubles')
  async getMyImmeubles(
    @Param('managerId') managerId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only access your own team buildings');
    // }
    
    return this.managerSpaceService.getManagerImmeubles(managerId);
  }

  // Récupérer un immeuble spécifique des commerciaux du manager connecté
  @Get(':managerId/immeubles/:immeubleId')
  async getMyImmeuble(
    @Param('managerId') managerId: string,
    @Param('immeubleId') immeubleId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only access your own team buildings');
    // }
    
    return this.managerSpaceService.getManagerImmeuble(managerId, immeubleId);
  }

  // Supprimer un immeuble des commerciaux du manager connecté
  @Delete(':managerId/immeubles/:immeubleId')
  async deleteMyImmeuble(
    @Param('managerId') managerId: string,
    @Param('immeubleId') immeubleId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('You can only delete your own team buildings');
    // }
    
    return this.managerSpaceService.deleteManagerImmeuble(managerId, immeubleId);
  }

  // Route pour vérifier l'accès à un commercial (utilitaire)
  @Get(':managerId/access/commercial/:commercialId')
  async verifyCommercialAccess(
    @Param('managerId') managerId: string,
    @Param('commercialId') commercialId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('Unauthorized access');
    // }
    
    const hasAccess = await this.managerSpaceService.verifyManagerAccess(managerId, commercialId);
    return { hasAccess };
  }

  // Route pour vérifier l'accès à une équipe (utilitaire)
  @Get(':managerId/access/equipe/:equipeId')
  async verifyEquipeAccess(
    @Param('managerId') managerId: string,
    @Param('equipeId') equipeId: string,
    // @Request() req: any // TODO: Récupérer l'ID du manager depuis le token JWT
  ) {
    // TODO: Vérifier que req.user.id === managerId pour sécuriser l'accès
    // if (req.user.id !== managerId) {
    //   throw new ForbiddenException('Unauthorized access');
    // }
    
    const hasAccess = await this.managerSpaceService.verifyManagerTeamAccess(managerId, equipeId);
    return { hasAccess };
  }
}