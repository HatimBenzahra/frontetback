import { Module } from '@nestjs/common';
// import { TranscriptionGateway } from './transcription.gateway';
import { TranscriptionHistoryModule } from '../../transcription-history/transcription-history.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [TranscriptionHistoryModule, AuthModule],
  // TranscriptionGateway temporairement désactivé pour éviter les duplications
  // EventsGateway gère maintenant tous les événements de transcription
  providers: [], // [TranscriptionGateway],
  exports: [], // [TranscriptionGateway],
})
export class TranscriptionModule {}