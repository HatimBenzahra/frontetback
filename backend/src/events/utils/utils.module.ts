import { Module } from '@nestjs/common';
import { UtilsGateway } from './utils.gateway';

@Module({
  providers: [UtilsGateway],
  exports: [UtilsGateway],
})
export class UtilsModule {}