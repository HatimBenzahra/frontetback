import { Module } from '@nestjs/common';
import { PorteService } from './porte.service';
import { PorteController } from './porte.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PortesModule } from '../events/portes/portes.module';
import { ActivityFeedModule } from '../activity-feed/activity-feed.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, PortesModule, ActivityFeedModule, EventsModule],
  controllers: [PorteController],
  providers: [PorteService],
})
export class PorteModule {}
