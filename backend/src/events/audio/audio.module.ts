import { Module } from '@nestjs/common';
import { AudioGateway } from './audio.gateway';
import { TranscriptionHistoryModule } from '../../transcription-history/transcription-history.module';
import { CommercialModule } from '../../manager-space/commercial/commercial.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [TranscriptionHistoryModule, CommercialModule, AuthModule],
  // AudioGateway réactivé pour gérer les événements WebRTC (sans créer de sessions dupliquées)
  providers: [AudioGateway],
  exports: [AudioGateway],
})
export class AudioModule {}