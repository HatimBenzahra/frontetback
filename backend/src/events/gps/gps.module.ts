import { Module } from '@nestjs/common';
import { GpsGateway } from './gps.gateway';
import { AuthModule } from '../../auth/auth.module';
import { CommercialService } from '../../manager-space/commercial/commercial.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  providers: [GpsGateway, CommercialService, PrismaService],
  exports: [GpsGateway],
})
export class GpsModule {}