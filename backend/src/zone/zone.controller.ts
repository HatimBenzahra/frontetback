import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ZoneService } from './zone.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
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

@Controller('zones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'commercial', 'directeur')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Post()
  create(@Body() createZoneDto: CreateZoneDto) {
    return this.zoneService.create(createZoneDto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    if (roles.includes('admin')) {
      // Admin voit toutes les zones
      return this.zoneService.findAll();
    } 
    else if (roles.includes('manager')) {
      // Manager voit seulement ses zones
      return this.zoneService.findAllForManager(managerId);
    }
    else if (roles.includes('commercial')) {
      // Commercial voit toutes les zones (pour informations générales)
      return this.zoneService.findAll();
    }
    else if (roles.includes('directeur')) {
      // Directeur voit toutes les zones
      return this.zoneService.findAll();
    }
    
    throw new ForbiddenException('Access denied');
  }

  @Get(':id/details')
  async getZoneDetails(@Param('id') id: string, @Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    if (roles.includes('admin')) {
      // Admin voit tous les détails
      return this.zoneService.getZoneDetails(id);
    } 
    else if (roles.includes('manager')) {
      // Manager voit seulement les détails de ses zones
      return this.zoneService.getZoneDetailsForManager(id, managerId);
    }
    else if (roles.includes('commercial')) {
      // Commercial voit seulement les détails des zones qui lui sont assignées
      return this.zoneService.getZoneDetailsForCommercial(id, req.user.userId);
    }
    
    throw new ForbiddenException('Access denied');
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    if (roles.includes('admin')) {
      // Admin voit toutes les zones
      return this.zoneService.findOne(id);
    } 
    else if (roles.includes('manager')) {
      // Manager voit seulement ses zones
      return this.zoneService.findOneForManager(id, managerId);
    }
    else if (roles.includes('commercial')) {
      // Commercial voit toutes les zones (infos générales seulement)
      return this.zoneService.findOne(id);
    }
    
    throw new ForbiddenException('Access denied');
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateZoneDto: UpdateZoneDto, @Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    // Seuls les admins et managers peuvent modifier les zones
    if (!roles.includes('admin') && !roles.includes('manager')) {
      throw new ForbiddenException('Seuls les admins et managers peuvent modifier les zones');
    }
    
    if (roles.includes('admin')) {
      // Admin peut modifier toutes les zones
      return this.zoneService.update(id, updateZoneDto);
    } 
    else if (roles.includes('manager')) {
      // Manager peut seulement modifier ses zones
      return this.zoneService.updateForManager(id, updateZoneDto, managerId);
    }
    
    throw new ForbiddenException('Access denied');
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    // Seuls les admins peuvent supprimer les zones (opération trop critique pour les managers)
    if (!roles.includes('admin')) {
      throw new ForbiddenException('Seuls les admins peuvent supprimer les zones');
    }
    
    return this.zoneService.remove(id);
  }

  @Post(':zoneId/assign-commercial')
  async assignCommercialToZone(
    @Param('zoneId') zoneId: string,
    @Body('commercialId') commercialId: string,
    @Body('assignedBy') assignedBy: string,
    @Request() req: AuthRequest
  ) {
    const { roles, managerId, userId } = req.user;
    
    // Seuls les admins et managers peuvent assigner des commerciaux à des zones
    if (!roles.includes('admin') && !roles.includes('manager')) {
      throw new ForbiddenException('Seuls les admins et managers peuvent assigner des commerciaux aux zones');
    }
    
    // Si c'est un manager, vérifier qu'il a l'autorité sur ce commercial et cette zone
    if (roles.includes('manager') && !roles.includes('admin')) {
      await this.zoneService.validateManagerAssignmentAuthority(managerId, zoneId, commercialId);
    }
    
    return this.zoneService.assignCommercialToZone(zoneId, commercialId, assignedBy || userId);
  }

  @Post(':zoneId/unassign-commercial')
  async unassignCommercialFromZone(
    @Param('zoneId') zoneId: string,
    @Body('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const { roles, managerId } = req.user;
    
    // Seuls les admins et managers peuvent désassigner des commerciaux
    if (!roles.includes('admin') && !roles.includes('manager')) {
      throw new ForbiddenException('Seuls les admins et managers peuvent désassigner des commerciaux des zones');
    }
    
    // Si c'est un manager, vérifier qu'il a l'autorité sur ce commercial et cette zone
    if (roles.includes('manager') && !roles.includes('admin')) {
      await this.zoneService.validateManagerAssignmentAuthority(managerId, zoneId, commercialId);
    }
    
    return this.zoneService.unassignCommercialFromZone(zoneId, commercialId);
  }

  @Get('statistics/all')
  async getZonesStatistics(@Request() req: AuthRequest) {
    const { roles } = req.user;
    
    // Seuls les admins et managers peuvent voir les statistiques détaillées des zones
    if (!roles.includes('admin') && !roles.includes('manager') && !roles.includes('directeur')) {
      throw new ForbiddenException('Access denied to zones statistics');
    }
    
    return this.zoneService.getZonesStatistics();
  }
}
