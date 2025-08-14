import { Module } from '@nestjs/common';
import { ImmeubleService } from './immeuble.service';
import { ImmeubleController, CommercialImmeubleController } from './immeuble.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [ImmeubleController, CommercialImmeubleController],
  providers: [ImmeubleService],
})
export class ImmeubleModule {}
