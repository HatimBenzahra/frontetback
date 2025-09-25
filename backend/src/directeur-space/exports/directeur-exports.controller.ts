import {
  Body,
  Controller,
  Post,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { DirecteurExportsService } from "./directeur-exports.service";
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

@Controller("directeur-space/exports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("directeur")
export class DirecteurExportsController {
  constructor(
    private readonly directeurExportsService: DirecteurExportsService,
  ) {}

  @Post("download")
  async download(
    @Request() req: AuthRequest,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const directeurId = req.user.directeurId;
    await this.directeurExportsService.download(directeurId, body, res);
  }
}
