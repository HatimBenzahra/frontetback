import { Module } from '@nestjs/common';
import { ImmeubleController } from './immeuble.controller';
import { ImmeubleService } from './immeuble.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ImmeubleController],
  providers: [ImmeubleService],
  exports: [ImmeubleService],
})
export class ImmeubleModule {}