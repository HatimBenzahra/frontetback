import { Module } from '@nestjs/common';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommercialController],
  providers: [CommercialService],
  exports: [CommercialService],
})
export class CommercialModule {}