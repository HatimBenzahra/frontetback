import { Module } from '@nestjs/common';
import { PorteController } from './porte.controller';
import { PorteService } from './porte.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PorteController],
  providers: [PorteService],
  exports: [PorteService],
})
export class PorteModule {}
