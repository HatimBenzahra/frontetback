import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ZoneModule } from './zone/zone.module';
import { EquipeModule } from './equipe/equipe.module';
import { CommercialModule } from './commercial/commercial.module';
import { ImmeubleModule } from './immeuble/immeuble.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { ManagerAssignmentGoalsModule } from './assignment-goals/assignment-goals.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule,
    ZoneModule,
    EquipeModule,
    CommercialModule,
    ImmeubleModule,
    TranscriptionModule,
    ManagerAssignmentGoalsModule
  ],
})
export class ManagerSpaceModule {}