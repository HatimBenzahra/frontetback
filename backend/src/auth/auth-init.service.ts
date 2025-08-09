import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeycloakService } from './keycloak.service';
import { JwtUtil } from './jwt.util';
import { MailerService } from './mailer.service';

@Injectable()
export class AuthInitService implements OnModuleInit {
  private readonly logger = new Logger(AuthInitService.name);

  constructor(
    private keycloakService: KeycloakService,
    private jwtUtil: JwtUtil,
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing Keycloak integration...');
      
      // Ensure roles exist in Keycloak
      await this.keycloakService.ensureRolesExist();
      
      // Check if admin user already exists
      const adminEmail = this.configService.get<string>('INITIAL_ADMIN_EMAIL') || 'admin@prospection.com';
      const existingAdmin = await this.keycloakService.getUserByEmail(adminEmail);
      
      if (!existingAdmin) {
        await this.createInitialAdmin(adminEmail);
      } else {
        this.logger.log('Admin user already exists');
      }
      
      this.logger.log('Keycloak integration initialized successfully');
    } catch (error: any) {
      this.logger.warn('Keycloak integration failed - application will continue without SSO');
      this.logger.warn('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      this.logger.warn('To fix this:');
      this.logger.warn('1. Verify KEYCLOAK_BASE_URL is correct');
      this.logger.warn('2. Verify KEYCLOAK_CLIENT_ID and CLIENT_SECRET are correct');
      this.logger.warn('3. Ensure the client has "Service accounts roles" enabled');
      this.logger.warn('4. Ensure the service account has realm-admin or manage-users role');
      
      // Don't throw here to prevent app from crashing
    }
  }

  private async createInitialAdmin(adminEmail: string) {
    try {
      // Create admin user in Keycloak
      const keycloakUserId = await this.keycloakService.createUser({
        email: adminEmail,
        firstName: 'Admin',
        lastName: 'System',
        role: 'admin',
      });

      // Generate setup token and log the setup link
      const setupToken = this.jwtUtil.signSetup(keycloakUserId);
      const setupLink = `${this.configService.get('FRONTEND_URL')}/setup-password?token=${setupToken}`;
      
      this.logger.log('='.repeat(80));
      this.logger.log('INITIAL ADMIN SETUP REQUIRED');
      this.logger.log('='.repeat(80));
      this.logger.log(`Admin email: ${adminEmail}`);
      this.logger.log(`Setup link: ${setupLink}`);
      this.logger.log('Please use this link to set the admin password (expires in 15 minutes)');
      this.logger.log('='.repeat(80));

      // Also try to send email if SMTP is configured
      try {
        await this.mailerService.sendSetupPasswordEmail(adminEmail, setupLink);
        this.logger.log('Admin setup email sent successfully');
      } catch (emailError) {
        this.logger.warn('Could not send admin setup email, use the link above instead');
      }

    } catch (error) {
      this.logger.error('Failed to create initial admin user', error);
      throw error;
    }
  }
}