import { Controller, Get, Logger } from '@nestjs/common';
import { AudioStreamingService } from './audio-streaming.service';

@Controller('/audio-streaming')
export class AudioStreamingController {
  private readonly logger = new Logger(AudioStreamingController.name);

  constructor(private readonly audioStreamingService: AudioStreamingService) {}

  @Get('/')
  getRoot() {
    return {
      message: 'Audio Streaming Service',
      status: 'running',
      version: '1.0.0',
    };
  }

  @Get('/health')
  getHealth() {
    const healthStatus = this.audioStreamingService.getHealthStatus();
    this.logger.log('Health check requested');
    
    return {
      ...healthStatus,
      service: 'audio-streaming-service',
      endpoints: {
        websocket: '/audio-streaming (Socket.IO)',
        health: '/audio-streaming/health',
        root: '/audio-streaming/',
      },
    };
  }

  @Get('/status')
  getStatus() {
    return {
      service: 'audio-streaming-service',
      status: 'active',
      features: [
        'WebRTC streaming',
        'Socket.IO signaling',
        'Multi-user support',
        'Real-time audio transmission',
      ],
      supportedEvents: [
        'register_user',
        'start_streaming',
        'stop_streaming',
        'join_commercial_stream',
        'leave_commercial_stream',
        'webrtc_offer',
        'webrtc_answer_from_admin',
        'webrtc_ice_candidate',
        'audio_data',
        'get_available_streams',
        'get_connection_stats',
      ],
    };
  }
}