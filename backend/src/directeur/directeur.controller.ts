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
import { DirecteurService } from './directeur.service';
import { CreateDirecteurDto } from './dto/create-directeur.dto';
import { UpdateDirecteurDto } from './dto/update-directeur.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('directeurs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DirecteurController {
  constructor(private readonly directeurService: DirecteurService) {}

  @Post()
  create(@Body() createDirecteurDto: CreateDirecteurDto) {
    return this.directeurService.create(createDirecteurDto);
  }

  @Get()
  findAll() {
    return this.directeurService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.directeurService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDirecteurDto: UpdateDirecteurDto) {
    return this.directeurService.update(id, updateDirecteurDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.directeurService.remove(id);
  }
}