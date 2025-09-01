import { Module } from '@nestjs/common';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EquipeController],
  providers: [EquipeService],
  exports: [EquipeService],
})
export class EquipeModule {}