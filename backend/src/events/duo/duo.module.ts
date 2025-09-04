import { Module } from '@nestjs/common';
import { DuoGateway } from './duo.gateway';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [DuoGateway],
  exports: [DuoGateway],
})
export class DuoModule {}