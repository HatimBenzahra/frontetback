import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ZoneService } from './zone.service';
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

@Controller('manager-space/zones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Get()
  async getMyZones(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.zoneService.getManagerZones(managerId);
  }
}