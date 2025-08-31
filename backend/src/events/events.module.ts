import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { TranscriptionHistoryModule } from '../transcription-history/transcription-history.module';
import { ManagerSpaceModule } from '../manager-space/manager-space.module';

@Module({
  imports: [TranscriptionHistoryModule, ManagerSpaceModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
