import { Module } from '@nestjs/common';
import { ImmeubleService } from './immeuble.service';
import { ImmeubleController, CommercialImmeubleController } from './immeuble.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PortesModule } from '../events/portes/portes.module';

@Module({
  imports: [PrismaModule, PortesModule],
  controllers: [ImmeubleController, CommercialImmeubleController],
  providers: [ImmeubleService],
})
export class ImmeubleModule {}
