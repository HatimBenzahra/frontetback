import { Module, forwardRef } from '@nestjs/common';
import { EquipeService } from './equipe.service';
import { EquipeController } from './equipe.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { DirecteurSpaceModule } from '../directeur-space.module';

@Module({
  imports: [PrismaModule, forwardRef(() => DirecteurSpaceModule)],
  controllers: [EquipeController],
  providers: [EquipeService],
})

export class EquipeModule {}