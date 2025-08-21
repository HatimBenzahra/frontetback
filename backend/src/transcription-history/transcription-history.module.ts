import { Module } from '@nestjs/common';
import { TranscriptionHistoryController } from './transcription-history.controller';
import { TranscriptionHistoryService } from './transcription-history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TextProcessingModule } from '../text-processing/text-processing.module';

@Module({
  imports: [PrismaModule, TextProcessingModule],
  controllers: [TranscriptionHistoryController],
  providers: [TranscriptionHistoryService],
  exports: [TranscriptionHistoryService],
})
export class TranscriptionHistoryModule {} 