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
import { CommercialService } from './commercial.service';
import { CreateCommercialDto } from './dto/create-commercial.dto';
import { UpdateCommercialDto } from './dto/update-commercial.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
  findAll() {
    return this.commercialService.findAll();
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
