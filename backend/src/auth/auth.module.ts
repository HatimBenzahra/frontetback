import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeycloakService } from './keycloak.service';
import { JwtUtil } from './jwt.util';
import { MailerService } from './mailer.service';
import { AuthController } from './auth.controller';
import { AuthInitService } from './auth-init.service';
import { CommercialModule } from '../commercial/commercial.module';
import { ManagerModule } from '../manager/manager.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommercialModule,
    ManagerModule,
  ],
  controllers: [AuthController],
  providers: [KeycloakService, JwtUtil, MailerService, AuthInitService],
  exports: [KeycloakService, JwtUtil, MailerService],
})
export class AuthModule {}