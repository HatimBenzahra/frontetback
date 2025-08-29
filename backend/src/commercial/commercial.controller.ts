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
import { CommercialService } from './commercial.service';
import { CreateCommercialDto } from './dto/create-commercial.dto';
import { UpdateCommercialDto } from './dto/update-commercial.dto';
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

@Controller('commerciaux')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'commercial')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Post()
  create(@Body() createCommercialDto: CreateCommercialDto) {
    return this.commercialService.create(createCommercialDto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest) {
    const { roles, managerId } = req.user;
    
    if (roles.includes('admin')) {
      // Admin voit tous les commerciaux
      return this.commercialService.findAll();
    } 
    else if (roles.includes('manager')) {
      // Manager voit seulement ses commerciaux
      return this.commercialService.findAllForManager(managerId);
    }
    else if (roles.includes('commercial')) {
      // Commercial voit tous les commerciaux (nécessaire pour prospection duo)
      return this.commercialService.findAll();
    }
    
    throw new ForbiddenException('Access denied');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commercialService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCommercialDto: UpdateCommercialDto,
  ) {
    return this.commercialService.update(id, updateCommercialDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commercialService.remove(id);
  }
}
