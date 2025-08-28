import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ImmeubleService } from './immeuble.service';
import { CreateImmeubleDto } from './dto/create-immeuble.dto';
import { UpdateImmeubleDto } from './dto/update-immeuble.dto';
import { CreateCommercialImmeubleDto } from './dto/create-commercial-immeuble.dto';
import { UpdateCommercialImmeubleDto } from './dto/update-commercial-immeuble.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';


// Admin Controller
@Controller('admin/immeubles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'commercial', 'manager')
export class ImmeubleController {
  constructor(private readonly immeubleService: ImmeubleService) {}

  @Post()
  create(@Body() createImmeubleDto: CreateImmeubleDto) {
    return this.immeubleService.create(createImmeubleDto);
  }

  @Get()
  findAll() {
    return this.immeubleService.findAll();
  }

  @Get(':id/details')
  getImmeubleDetails(@Param('id') id: string) {
    return this.immeubleService.getImmeubleDetails(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.immeubleService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateImmeubleDto: UpdateImmeubleDto,
  ) {
    return this.immeubleService.update(id, updateImmeubleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.immeubleService.remove(id);
  }
}

// Commercial Controller
@Controller('commercial/:commercialId/immeubles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('commercial')
export class CommercialImmeubleController {
  constructor(private readonly immeubleService: ImmeubleService) {}

  @Post()
  create(
    @Param('commercialId') commercialId: string,
    @Body() createDto: CreateCommercialImmeubleDto,
  ) {
    return this.immeubleService.createForCommercial(createDto, commercialId);
  }

  @Get()
  findAll(@Param('commercialId') commercialId: string) {
    return this.immeubleService.findAllForCommercial(commercialId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Param('commercialId') commercialId: string,
  ) {
    return this.immeubleService.findOneForCommercial(id, commercialId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Param('commercialId') commercialId: string,
    @Body() updateDto: UpdateCommercialImmeubleDto,
  ) {
    return this.immeubleService.updateForCommercial(id, updateDto, commercialId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Param('commercialId') commercialId: string,
  ) {
    return this.immeubleService.removeForCommercial(id, commercialId);
  }
}
