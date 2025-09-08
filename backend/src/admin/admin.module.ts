import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { CommercialModule } from '../commercial/commercial.module';
import { ManagerModule } from '../manager/manager.module';
import { DirecteurModule } from '../directeur/directeur.module';

@Module({
  imports: [AuthModule, CommercialModule, ManagerModule, DirecteurModule],
  controllers: [AdminController],
})
export class AdminModule {}