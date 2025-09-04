import { Module } from '@nestjs/common';
import { PortesGateway } from './portes.gateway';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [PortesGateway],
  exports: [PortesGateway],
})
export class PortesModule {}