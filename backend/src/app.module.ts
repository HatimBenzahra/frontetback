import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ManagerModule } from './manager/manager.module';
import { DirecteurModule } from './directeur/directeur.module';
import { EquipeModule } from './equipe/equipe.module';
import { CommercialModule } from './commercial/commercial.module';
import { ZoneModule } from './zone/zone.module';
import { ImmeubleModule } from './immeuble/immeuble.module';
import { PorteModule } from './porte/porte.module';
import { StatisticsModule } from './statistics/statistics.module';
import { AssignmentGoalsModule } from './assignment-goals/assignment-goals.module';
import { ProspectionModule } from './prospection/prospection.module';
import { EventsModule } from './events/events.module';
import { GlobalEventsModule } from './events/global-events.module';
import { TranscriptionHistoryModule } from './transcription-history/transcription-history.module';
import { ExportsModule } from './exports/exports.module';
import { ManagerSpaceModule } from './manager-space/manager-space.module';
import { DirecteurSpaceModule } from './directeur-space/directeur-space.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // SchedulerModule, // Temporairement désactivé pour résoudre l'erreur de dépendance
    GlobalEventsModule,
    PrismaModule,
    AuthModule,
    AdminModule,
    ManagerModule,
    DirecteurModule,
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
    ExportsModule,
    ManagerSpaceModule,
    DirecteurSpaceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
