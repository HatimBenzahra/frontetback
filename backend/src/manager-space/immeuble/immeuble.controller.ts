import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ImmeubleService } from './immeuble.service';
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

@Controller('manager-space/immeubles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ImmeubleController {
  constructor(private readonly immeubleService: ImmeubleService) {}

  @Get()
  async getMyImmeubles(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.immeubleService.getManagerImmeubles(managerId);
  }

  @Get(':immeubleId')
  async getMyImmeuble(
    @Param('immeubleId') immeubleId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.immeubleService.getManagerImmeuble(managerId, immeubleId);
  }

  @Delete(':immeubleId')
  async deleteMyImmeuble(
    @Param('immeubleId') immeubleId: string,
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.immeubleService.deleteManagerImmeuble(managerId, immeubleId);
  }
}