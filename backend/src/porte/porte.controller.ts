import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PorteService } from './porte.service';
import { CreatePorteDto } from './dto/create-porte.dto';
import { UpdatePorteDto } from './dto/update-porte.dto';

@Controller('portes')
export class PorteController {
  constructor(private readonly porteService: PorteService) {}

  @Post()
  create(@Body() createPorteDto: CreatePorteDto) {
    return this.porteService.create(createPorteDto);
  }

  @Get()
  findAll() {
    return this.porteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.porteService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePorteDto: UpdatePorteDto) {
    return this.porteService.update(id, updatePorteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.porteService.remove(id);
  }

  @Get('rendez-vous-semaine/:commercialId')
  getRendezVousSemaine(@Param('commercialId') commercialId: string) {
    return this.porteService.getRendezVousSemaine(commercialId);
  }

  @Get('admin/rendez-vous-semaine')
  getAllRendezVousSemaine() {
    return this.porteService.getAllRendezVousSemaine();
  }
}
