import { Module } from '@nestjs/common';
import { AudioStreamingGateway } from './audio-streaming.gateway';
import { AudioStreamingController } from './audio-streaming.controller';
import { AudioStreamingService } from './audio-streaming.service';

@Module({
  controllers: [AudioStreamingController],
  providers: [AudioStreamingGateway, AudioStreamingService],
  exports: [AudioStreamingGateway, AudioStreamingService],
})
export class AudioStreamingModule {}