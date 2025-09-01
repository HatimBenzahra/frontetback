import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { TranscriptionHistoryModule } from '../transcription-history/transcription-history.module';
import { CommercialModule } from '../manager-space/commercial/commercial.module';

@Module({
  imports: [TranscriptionHistoryModule, CommercialModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
