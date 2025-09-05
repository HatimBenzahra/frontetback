import { Module } from '@nestjs/common';
import { PorteController } from './porte.controller';
import { PorteService } from './porte.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PortesModule } from '../../events/portes/portes.module';

@Module({
  imports: [PrismaModule, PortesModule],
  controllers: [PorteController],
  providers: [PorteService],
  exports: [PorteService],
})
export class PorteModule {}
