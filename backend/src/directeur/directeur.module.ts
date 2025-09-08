import { Module } from '@nestjs/common';
import { DirecteurService } from './directeur.service';
import { DirecteurController } from './directeur.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DirecteurController],
  providers: [DirecteurService],
  exports: [DirecteurService],
})
export class DirecteurModule {}