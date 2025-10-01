import { Module } from '@nestjs/common';
import { GpsGateway } from './gps.gateway';
import { AuthModule } from '../../auth/auth.module';
import { CommercialService } from '../../manager-space/commercial/commercial.service';
import { DirecteurSpaceService } from '../../directeur-space/directeur-space.service';
import { AssignmentGoalsService } from '../../assignment-goals/assignment-goals.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  providers: [GpsGateway, CommercialService, DirecteurSpaceService, AssignmentGoalsService, PrismaService],
  exports: [GpsGateway],
})
export class GpsModule {}