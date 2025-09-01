import { Module } from '@nestjs/common';
import { ZoneController } from './zone.controller';
import { ZoneService } from './zone.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ZoneController],
  providers: [ZoneService],
  exports: [ZoneService],
})
export class ZoneModule {}