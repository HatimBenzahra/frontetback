import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ZoneService } from './zone.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Post()
  create(@Body() createZoneDto: CreateZoneDto) {
    return this.zoneService.create(createZoneDto);
  }

  @Get()
  findAll() {
    return this.zoneService.findAll();
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
