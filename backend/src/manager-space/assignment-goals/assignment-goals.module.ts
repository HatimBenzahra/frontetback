import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { ManagerAssignmentGoalsService } from './assignment-goals.service';
import { ManagerAssignmentGoalsController } from './assignment-goals.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ManagerAssignmentGoalsController],
  providers: [ManagerAssignmentGoalsService],
  exports: [ManagerAssignmentGoalsService],
})
export class ManagerAssignmentGoalsModule {}
