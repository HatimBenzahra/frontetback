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
@Roles('admin', 'manager', 'commercial')
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
    
    throw new ForbiddenException('Access denied');
  }

  @Get(':id/details')
  getZoneDetails(@Param('id') id: string) {
    return this.zoneService.getZoneDetails(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zoneService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateZoneDto: UpdateZoneDto) {
    return this.zoneService.update(id, updateZoneDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.zoneService.remove(id);
  }

  @Post(':zoneId/assign-commercial')
  assignCommercialToZone(
    @Param('zoneId') zoneId: string,
    @Body('commercialId') commercialId: string,
    @Body('assignedBy') assignedBy?: string
  ) {
    return this.zoneService.assignCommercialToZone(zoneId, commercialId, assignedBy);
  }

  @Post(':zoneId/unassign-commercial')
  unassignCommercialFromZone(
    @Param('zoneId') zoneId: string,
    @Body('commercialId') commercialId: string
  ) {
    return this.zoneService.unassignCommercialFromZone(zoneId, commercialId);
  }
}
