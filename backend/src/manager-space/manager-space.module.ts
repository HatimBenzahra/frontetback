import { Module } from '@nestjs/common';
import { ManagerSpaceController } from './manager-space.controller';
import { ManagerSpaceService } from './manager-space.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ManagerSpaceController],
  providers: [ManagerSpaceService],
  exports: [ManagerSpaceService],
})
export class ManagerSpaceModule {}