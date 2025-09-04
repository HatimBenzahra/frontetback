import { Module } from '@nestjs/common';
import { AudioModule } from './audio/audio.module';
import { GpsModule } from './gps/gps.module';
import { PortesModule } from './portes/portes.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { UtilsModule } from './utils/utils.module';
import { DuoModule } from './duo/duo.module';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { TranscriptionHistoryModule } from '../transcription-history/transcription-history.module';
import { CommercialModule } from '../manager-space/commercial/commercial.module';

@Module({
  imports: [
    AudioModule, 
    GpsModule, 
    PortesModule, 
    TranscriptionModule, 
    UtilsModule, 
    DuoModule,
    AuthModule,
    TranscriptionHistoryModule,
    CommercialModule
  ],
  providers: [EventsGateway],
  exports: [AudioModule, GpsModule, PortesModule, TranscriptionModule, UtilsModule, DuoModule, EventsGateway],
})
export class EventsModule {}
