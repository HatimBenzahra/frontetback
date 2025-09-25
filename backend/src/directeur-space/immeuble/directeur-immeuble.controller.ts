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

@Controller("directeur-space/immeubles")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("directeur")
export class DirecteurImmeubleController {
  constructor(private readonly directeurSpaceService: DirecteurSpaceService) {}

  @Get()
  async listImmeubles(@Request() req: AuthRequest) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.getDirecteurImmeubles(directeurId);
  }

  @Get(":immeubleId")
  async getImmeuble(
    @Param("immeubleId") immeubleId: string,
    @Request() req: AuthRequest,
  ) {
    const directeurId = req.user.directeurId;
    return this.directeurSpaceService.getDirecteurImmeuble(
      directeurId,
      immeubleId,
    );
  }
}
