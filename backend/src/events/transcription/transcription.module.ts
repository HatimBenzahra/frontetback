import { Module } from '@nestjs/common';
import { TranscriptionGateway } from './transcription.gateway';
import { TranscriptionHistoryModule } from '../../transcription-history/transcription-history.module';

@Module({
  imports: [TranscriptionHistoryModule],
  providers: [TranscriptionGateway],
  exports: [TranscriptionGateway],
})
export class TranscriptionModule {}