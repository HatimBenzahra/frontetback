import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { TranscriptionHistoryModule } from '../transcription-history/transcription-history.module';

@Module({
  imports: [PrismaModule, StatisticsModule, TranscriptionHistoryModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}

