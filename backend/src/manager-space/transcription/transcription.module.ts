import { Module } from '@nestjs/common';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}