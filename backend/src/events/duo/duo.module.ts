import { Module } from '@nestjs/common';
import { DuoGateway } from './duo.gateway';

@Module({
  providers: [DuoGateway],
  exports: [DuoGateway],
})
export class DuoModule {}