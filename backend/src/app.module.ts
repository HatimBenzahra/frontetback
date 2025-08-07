import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ManagerModule } from './manager/manager.module';
import { EquipeModule } from './equipe/equipe.module';
import { CommercialModule } from './commercial/commercial.module';
import { ZoneModule } from './zone/zone.module';
import { ImmeubleModule } from './immeuble/immeuble.module';
import { PorteModule } from './porte/porte.module';
import { StatisticsModule } from './statistics/statistics.module';
import { AssignmentGoalsModule } from './assignment-goals/assignment-goals.module';
import { ProspectionModule } from './prospection/prospection.module';
import { EventsModule } from './events/events.module';
import { TranscriptionHistoryModule } from './transcription-history/transcription-history.module';

@Module({
  imports: [
    PrismaModule,
    ManagerModule,
    EquipeModule,
    CommercialModule,
    ZoneModule,
    ImmeubleModule,
    PorteModule,
    StatisticsModule,
    AssignmentGoalsModule,
    ProspectionModule,
    EventsModule,
    TranscriptionHistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
