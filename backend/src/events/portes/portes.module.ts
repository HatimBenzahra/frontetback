import { Module } from '@nestjs/common';
import { PortesGateway } from './portes.gateway';

@Module({
  providers: [PortesGateway],
  exports: [PortesGateway],
})
export class PortesModule {}