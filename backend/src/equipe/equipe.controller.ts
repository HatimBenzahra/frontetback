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
import { EquipeService } from './equipe.service';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { UpdateEquipeDto } from './dto/update-equipe.dto';
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
  async findAll(@Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    if (roles.includes('admin')) {
      // Admin voit toutes les équipes
      return this.equipeService.findAll();
    } 
    else if (roles.includes('manager')) {
      // Manager voit seulement ses équipes
      return this.equipeService.findAllForManager(managerId);
    }
    else if (roles.includes('commercial')) {
      // Commercial voit toutes les équipes (pour informations générales)
      return this.equipeService.findAll();
    }
    
    throw new ForbiddenException('Access denied');
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
