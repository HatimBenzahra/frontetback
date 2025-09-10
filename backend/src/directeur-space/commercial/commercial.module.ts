import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DirecteurSpaceService } from '../directeur-space.service';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommercialController],
  providers: [CommercialService, DirecteurSpaceService],
  exports: [CommercialService],
})
export class DirecteurCommercialModule {}

