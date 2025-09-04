import { Module } from '@nestjs/common';
import { GpsGateway } from './gps.gateway';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [GpsGateway],
  exports: [GpsGateway],
})
export class GpsModule {}