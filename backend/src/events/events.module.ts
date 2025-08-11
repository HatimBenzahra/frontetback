import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { TranscriptionHistoryModule } from '../transcription-history/transcription-history.module';

@Module({
  imports: [TranscriptionHistoryModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
