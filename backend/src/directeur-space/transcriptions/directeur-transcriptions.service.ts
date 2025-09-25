import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DirecteurSpaceService } from "../directeur-space.service";
import { TranscriptionHistoryService } from "../../transcription-history/transcription-history.service";

export interface BackupSettings {
  maxSessions: number;
  maxSizeMB: number;
  keepRecentSessions: number;
}

@Injectable()
export class DirecteurTranscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directeurSpaceService: DirecteurSpaceService,
    private readonly transcriptionHistoryService: TranscriptionHistoryService,
  ) {}

  async listCommercials(directeurId: string) {
    return this.directeurSpaceService.getDirecteurTranscriptionCommercials(
      directeurId,
    );
  }

  async getTranscriptions(
    directeurId: string,
    options: {
      commercialId?: string;
      buildingId?: string;
      limit?: number;
    } = {},
  ) {
    return this.directeurSpaceService.getDirecteurTranscriptions(
      directeurId,
      options,
    );
  }

  async getBackupSettings() {
    const response = await this.transcriptionHistoryService.getBackupSettings();
    if (response && response.settings) {
      return response;
    }
    return {
      success: true,
      settings: {
        maxSessions: 1000,
        maxSizeMB: 50,
        keepRecentSessions: 100,
      },
    };
  }

  async updateBackupSettings(settings: BackupSettings) {
    return this.transcriptionHistoryService.updateBackupSettings(settings);
  }

  private async resolveSettings(): Promise<BackupSettings> {
    const current = await this.getBackupSettings();
    return current?.settings as BackupSettings;
  }

  async checkAutoBackup(directeurId: string) {
    const commercialIds =
      await this.directeurSpaceService.getDirecteurCommercialIds(directeurId);
    const settings = await this.resolveSettings();

    if (!commercialIds.length) {
      return {
        success: true,
        autoBackupNeeded: false,
        totalSessions: 0,
        estimatedSizeMB: 0,
        settings,
        isAutoBackup: false,
      };
    }

    const totalSessions = await this.prisma.transcriptionSession.count({
      where: {
        commercial_id: { in: commercialIds },
      },
    });

    const estimatedSizeMB = totalSessions / 1024; // approximation 1KB/session
    const needsBackup =
      totalSessions >= settings.maxSessions ||
      estimatedSizeMB >= settings.maxSizeMB;

    if (!needsBackup) {
      return {
        success: true,
        autoBackupNeeded: false,
        totalSessions,
        estimatedSizeMB,
        settings,
        isAutoBackup: false,
      };
    }

    const sessions = await this.prisma.transcriptionSession.findMany({
      where: {
        commercial_id: { in: commercialIds },
      },
      orderBy: { start_time: "desc" },
    });

    const backup = await this.transcriptionHistoryService.backupToS3(true);

    return {
      success: backup.success,
      isAutoBackup: true,
      backup,
      totalSessions,
      estimatedSizeMB,
      settings,
    };
  }

  async backupToS3(directeurId: string) {
    const commercialIds =
      await this.directeurSpaceService.getDirecteurCommercialIds(directeurId);
    if (!commercialIds.length) {
      return {
        success: true,
        message: "Aucune transcription disponible pour ce directeur",
      };
    }

    return this.transcriptionHistoryService.backupToS3(false);
  }
}
