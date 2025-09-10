import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommercialService } from './commercial.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

interface AuthRequest extends Request {
  user: {
    directeurId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller('directeur-space/commerciaux')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('directeur')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get()
  async getMyCommerciaux(
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.commercialService.getDirecteurCommerciaux(directeurId);
  }

  @Get(':commercialId')
  async getMyCommercial(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.commercialService.getDirecteurCommercial(directeurId, commercialId);
  }

  @Get('access/:commercialId')
  async verifyCommercialAccess(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.commercialService.getDirecteurCommercial(directeurId, commercialId);
  }

  @Get(':commercialId/historiques')
  async getCommercialHistoriques(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.commercialService.getDirecteurCommercialHistoriques(directeurId, commercialId);
  }

  @Get(':commercialId/transcriptions')
  async getCommercialTranscriptions(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.commercialService.getDirecteurCommercialTranscriptions(directeurId, commercialId);
  }

  @Get(':commercialId/stats')
  async getCommercialStats(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const directeurId = req.user.directeurId;
    return this.commercialService.getDirecteurCommercialStats(directeurId, commercialId);
  }
}

