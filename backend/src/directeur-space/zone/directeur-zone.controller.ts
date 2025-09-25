import { Controller, Get, Param, Request, UseGuards } from "@nestjs/common";
import { DirecteurSpaceService } from "../directeur-space.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";

interface AuthRequest extends Request {
  user: {
    directeurId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller("directeur-space/zones")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("directeur")
export class DirecteurZoneController {
  constructor(private readonly directeurSpaceService: DirecteurSpaceService) {}

  @Get()
  async listZones(@Request() req: AuthRequest) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.getDirecteurZones(directeurId);
  }

  @Get(":zoneId")
  async getZone(@Param("zoneId") zoneId: string, @Request() req: AuthRequest) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.getDirecteurZone(directeurId, zoneId);
  }
}
