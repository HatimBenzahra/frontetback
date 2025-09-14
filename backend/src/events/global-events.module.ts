import { Global, Module } from '@nestjs/common';
import { EventEmitterService } from './event-emitter.service';

@Global()
@Module({
  providers: [
    {
      provide: 'EventEmitterService',
      useClass: EventEmitterService,
    },
  ],
  exports: ['EventEmitterService'],
})
export class GlobalEventsModule {}
