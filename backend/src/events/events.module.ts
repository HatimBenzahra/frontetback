import { Module } from '@nestjs/common';
import { AudioModule } from './audio/audio.module';
import { GpsModule } from './gps/gps.module';
import { PortesModule } from './portes/portes.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { UtilsModule } from './utils/utils.module';
import { DuoModule } from './duo/duo.module';

@Module({
  imports: [AudioModule, GpsModule, PortesModule, TranscriptionModule, UtilsModule, DuoModule],
  exports: [AudioModule, GpsModule, PortesModule, TranscriptionModule, UtilsModule, DuoModule],
})
export class EventsModule {}
