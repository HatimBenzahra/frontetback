import { Module } from '@nestjs/common';
import { PorteService } from './porte.service';
import { PorteController } from './porte.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ActivityFeedModule } from '../activity-feed/activity-feed.module';

@Module({
  imports: [PrismaModule, EventsModule, ActivityFeedModule],
  controllers: [PorteController],
  providers: [PorteService],
})
export class PorteModule {}
