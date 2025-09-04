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
} from '@nestjs/common';
import { ZoneService } from './zone.service';
import { CreateZoneDto } from '../../zone/dto/create-zone.dto';
import { UpdateZoneDto } from '../../zone/dto/update-zone.dto';
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

@Controller('manager-space/zones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Post()
  async create(@Body() createZoneDto: CreateZoneDto, @Request() req: AuthRequest) {
    const managerId = req.user.managerId;
    return this.zoneService.createForManager(createZoneDto, managerId);
  }

  @Get()
  async getMyZones(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.zoneService.getManagerZones(managerId);
  }

  @Get(':id/details')
  async getZoneDetails(@Param('id') id: string, @Request() req: AuthRequest) {
    const managerId = req.user.managerId;
    return this.zoneService.getZoneDetailsForManager(id, managerId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const managerId = req.user.managerId;
    return this.zoneService.findOneForManager(id, managerId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateZoneDto: UpdateZoneDto, @Request() req: AuthRequest) {
    const managerId = req.user.managerId;
    return this.zoneService.updateForManager(id, updateZoneDto, managerId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const managerId = req.user.managerId;
    return this.zoneService.removeForManager(id, managerId);
  }

  @Post(':zoneId/assign-commercial')
  async assignCommercialToZone(
    @Param('zoneId') zoneId: string,
    @Body('commercialId') commercialId: string,
    @Body('assignedBy') assignedBy: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    const userId = req.user.userId;
    return this.zoneService.assignCommercialToZoneForManager(zoneId, commercialId, assignedBy || userId, managerId);
  }

  @Post(':zoneId/unassign-commercial')
  async unassignCommercialFromZone(
    @Param('zoneId') zoneId: string,
    @Body('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.zoneService.unassignCommercialFromZoneForManager(zoneId, commercialId, managerId);
  }

  @Get('statistics/all')
  async getZonesStatistics(@Request() req: AuthRequest) {
    const managerId = req.user.managerId;
    return this.zoneService.getZonesStatisticsForManager(managerId);
  }
}