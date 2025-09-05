import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { ProfileService } from './profile.service';

@Controller('manager-space/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@Request() req) {
    return this.profileService.getManagerProfile(req.user.id);
  }

  @Patch()
  async updateProfile(@Request() req, @Body() updateData: any) {
    return this.profileService.updateManagerProfile(req.user.id, updateData);
  }
}
