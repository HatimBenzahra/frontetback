import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PorteService } from './porte.service';
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

@Controller('manager-space/portes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class PorteController {
  constructor(private readonly porteService: PorteService) {}

  @Get('immeuble/:immeubleId')
  async getPortesForImmeuble(
    @Param('immeubleId') immeubleId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.porteService.getPortesForImmeuble(managerId, immeubleId);
  }

  @Get(':porteId')
  async getPorte(
    @Param('porteId') porteId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.porteService.getPorte(managerId, porteId);
  }

  @Post()
  async createPorte(
    @Body() createPorteDto: any,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.porteService.createPorte(managerId, createPorteDto);
  }

  @Patch(':porteId')
  async updatePorte(
    @Param('porteId') porteId: string,
    @Body() updatePorteDto: any,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.porteService.updatePorte(managerId, porteId, updatePorteDto);
  }

  @Delete(':porteId')
  async deletePorte(
    @Param('porteId') porteId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.porteService.deletePorte(managerId, porteId);
  }
}
