import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { DirecteurTranscriptionsService } from "./directeur-transcriptions.service";
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

@Controller("directeur-space/transcriptions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("directeur")
export class DirecteurTranscriptionsController {
  constructor(
    private readonly directeurTranscriptionsService: DirecteurTranscriptionsService,
  ) {}

  @Get("commercials")
  async getCommercials(@Request() req: AuthRequest) {
    const directeurId = req.user.directeurId;
    const commercials =
      await this.directeurTranscriptionsService.listCommercials(directeurId);
    return { commercials };
  }

  @Get()
  async getTranscriptions(
    @Request() req: AuthRequest,
    @Query("commercialId") commercialId?: string,
    @Query("buildingId") buildingId?: string,
    @Query("limit") limit?: string,
  ) {
    const directeurId = req.user.directeurId;
    const take = limit ? parseInt(limit, 10) : undefined;
    return this.directeurTranscriptionsService.getTranscriptions(directeurId, {
      commercialId,
      buildingId,
      limit: take,
    });
  }

  @Post("check-auto-backup")
  async checkAutoBackup(@Request() req: AuthRequest) {
    const directeurId = req.user.directeurId;
    return this.directeurTranscriptionsService.checkAutoBackup(directeurId);
  }

  @Post("backup-to-s3")
  async backupToS3(@Request() req: AuthRequest) {
    const directeurId = req.user.directeurId;
    return this.directeurTranscriptionsService.backupToS3(directeurId);
  }

  @Get("backup-settings")
  async getBackupSettings() {
    return this.directeurTranscriptionsService.getBackupSettings();
  }

  @Post("update-backup-settings")
  async updateBackupSettings(
    @Body()
    body: {
      maxSessions: number;
      maxSizeMB: number;
      keepRecentSessions: number;
    },
  ) {
    return this.directeurTranscriptionsService.updateBackupSettings(body);
  }
}
