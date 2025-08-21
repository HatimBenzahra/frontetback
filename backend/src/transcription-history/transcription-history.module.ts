import { Module } from '@nestjs/common';
import { TranscriptionHistoryController } from './transcription-history.controller';
import { TranscriptionHistoryService } from './transcription-history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [PrismaModule, GeminiModule],
  controllers: [TranscriptionHistoryController],
  providers: [TranscriptionHistoryService],
  exports: [TranscriptionHistoryService],
})
export class TranscriptionHistoryModule {} 