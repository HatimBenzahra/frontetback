import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AssignmentGoalsModule } from '../assignment-goals/assignment-goals.module';
import { DirecteurSpaceService } from './directeur-space.service';
import { DirecteurSpaceController } from './directeur-space.controller';
import { DirecteurCommercialModule } from './commercial/commercial.module';
import { DirecteurManagerModule } from './manager/manager.module';
import { EquipeModule } from './equipe/equipe.module';
import { DirecteurStatisticsModule } from './statistics/directeur-statistics.module';
import { DirecteurImmeubleModule } from './immeuble/directeur-immeuble.module';
import { DirecteurTranscriptionsModule } from './transcriptions/directeur-transcriptions.module';
import { DirecteurZoneModule } from './zone/directeur-zone.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AssignmentGoalsModule,
    DirecteurCommercialModule,
    DirecteurManagerModule,
    forwardRef(() => EquipeModule),
    DirecteurStatisticsModule,
    DirecteurImmeubleModule,
    DirecteurTranscriptionsModule,
    DirecteurZoneModule
  ],
  controllers: [DirecteurSpaceController],
  providers: [DirecteurSpaceService],
  exports: [DirecteurSpaceService],
})
export class DirecteurSpaceModule {}

