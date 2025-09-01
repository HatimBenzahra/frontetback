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
    managerId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller('manager-space/commerciaux')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get()
  async getMyCommerciaux(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.commercialService.getManagerCommerciaux(managerId);
  }

  @Get(':commercialId')
  async getMyCommercial(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.commercialService.getManagerCommercial(managerId, commercialId);
  }

  @Get('access/:commercialId')
  async verifyCommercialAccess(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    const hasAccess = await this.commercialService.verifyManagerAccess(managerId, commercialId);
    return { hasAccess };
  }

  @Get(':commercialId/historiques')
  async getCommercialHistoriques(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.commercialService.getCommercialHistoriques(managerId, commercialId);
  }

  @Get(':commercialId/transcriptions')
  async getCommercialTranscriptions(
    @Param('commercialId') commercialId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.commercialService.getCommercialTranscriptions(managerId, commercialId);
  }
}