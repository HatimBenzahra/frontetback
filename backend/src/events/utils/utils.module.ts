import { Module } from '@nestjs/common';
import { UtilsGateway } from './utils.gateway';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [UtilsGateway],
  exports: [UtilsGateway],
})
export class UtilsModule {}