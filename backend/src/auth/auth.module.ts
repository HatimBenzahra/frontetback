import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeycloakService } from './keycloak.service';
import { JwtUtil } from './jwt.util';
import { MailerService } from './mailer.service';
import { AuthController } from './auth.controller';
import { AuthInitService } from './auth-init.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { WsAuthGuard } from './ws-auth.guard';
import { WsRolesGuard } from './ws-roles.guard';
import { CommercialModule } from '../commercial/commercial.module';
import { ManagerModule } from '../manager/manager.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommercialModule,
    ManagerModule,
  ],
  controllers: [AuthController],
  providers: [KeycloakService, JwtUtil, MailerService, AuthInitService, JwtAuthGuard, RolesGuard, WsAuthGuard, WsRolesGuard],
  exports: [KeycloakService, JwtUtil, MailerService, JwtAuthGuard, RolesGuard, WsAuthGuard, WsRolesGuard],
})
export class AuthModule {}