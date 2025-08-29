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
import { EquipeService } from './equipe.service';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { UpdateEquipeDto } from './dto/update-equipe.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('equipes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'commercial')
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Post()
  create(@Body() createEquipeDto: CreateEquipeDto) {
    return this.equipeService.create(createEquipeDto);
  }

  @Get()
  findAll() {
    return this.equipeService.findAll();
  }

  @Get(':id/details')
  getEquipeDetails(@Param('id') id: string) {
    return this.equipeService.getEquipeDetails(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipeService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEquipeDto: UpdateEquipeDto) {
    return this.equipeService.update(id, updateEquipeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.equipeService.remove(id);
  }
}
