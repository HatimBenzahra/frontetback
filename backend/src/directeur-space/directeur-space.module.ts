import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DirecteurSpaceService } from './directeur-space.service';
import { DirecteurCommercialModule } from './commercial/commercial.module';
import { DirecteurManagerModule } from './manager/manager.module';
import { EquipeModule } from './equipe/equipe.module';
import { DirecteurStatisticsModule } from './statistics/directeur-statistics.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule,
    DirecteurCommercialModule,
    DirecteurManagerModule,
    forwardRef(() => EquipeModule),
    DirecteurStatisticsModule
  ],
  providers: [DirecteurSpaceService],
  exports: [DirecteurSpaceService],
})
export class DirecteurSpaceModule {}

