import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AssignmentGoalsModule } from "../../assignment-goals/assignment-goals.module";
import { TranscriptionHistoryModule } from "../../transcription-history/transcription-history.module";
import { DirecteurSpaceService } from "../directeur-space.service";
import { DirecteurTranscriptionsService } from "./directeur-transcriptions.service";
import { DirecteurTranscriptionsController } from "./directeur-transcriptions.controller";

@Module({
  imports: [PrismaModule, AssignmentGoalsModule, TranscriptionHistoryModule],
  controllers: [DirecteurTranscriptionsController],
  providers: [DirecteurTranscriptionsService, DirecteurSpaceService],
})
export class DirecteurTranscriptionsModule {}
