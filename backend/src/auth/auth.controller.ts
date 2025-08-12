import { Body, Controller, Post, Query, BadRequestException, NotFoundException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { JwtUtil } from './jwt.util';
import { MailerService } from './mailer.service';
import { ConfigService } from '@nestjs/config';
import { CommercialService } from '../commercial/commercial.service';
import { ManagerService } from '../manager/manager.service';

interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'commercial';
  telephone?: string;
  equipeId?: string;
  managerId?: string;
}

interface SetupPasswordDto {
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private keycloakService: KeycloakService,
    private jwtUtil: JwtUtil,
    private mailerService: MailerService,
    private configService: ConfigService,
    private commercialService: CommercialService,
    private managerService: ManagerService,
  ) {}

  @Post('create-user')
  async createUser(@Body() dto: CreateUserDto) {
    const { email, firstName, lastName, role, telephone, equipeId, managerId } = dto;

    if (!email || !firstName || !lastName || !role) {
      throw new BadRequestException('Email, firstName, lastName, and role are required');
    }

    if (role === 'commercial' && (!equipeId || !managerId)) {
      throw new BadRequestException('Commercial users require equipeId and managerId');
    }

    try {
      // Create user in Keycloak
      const keycloakUserId = await this.keycloakService.createUser({
        email,
        firstName,
        lastName,
        role,
      });

      // Create user in local database based on role
      let localUserId: string;
      
      switch (role) {
        case 'commercial':
          if (!equipeId || !managerId) {
            throw new BadRequestException('Commercial users require equipeId and managerId');
          }
          const commercial = await this.commercialService.create({
            nom: lastName,
            prenom: firstName,
            email,
            telephone,
            equipeId,
            managerId,
          });
          localUserId = commercial.id;
          break;

        case 'manager':
          const manager = await this.managerService.create({
            nom: lastName,
            prenom: firstName,
            email,
            telephone,
          });
          localUserId = manager.id;
          break;

        case 'admin':
          // For admin, we just use the Keycloak ID
          localUserId = keycloakUserId;
          break;

        default:
          throw new BadRequestException('Invalid role');
      }

      // Generate setup token and send email
      const setupToken = this.jwtUtil.signSetup(keycloakUserId);
      const setupLink = `${this.configService.get('FRONTEND_URL')}/setup-password?token=${setupToken}`;
      
      await this.mailerService.sendSetupPasswordEmail(email, setupLink);

      this.logger.log(`User created successfully: ${email} (${role})`);
      
      return {
        success: true,
        keycloakId: keycloakUserId,
        localId: localUserId,
        role,
        message: 'User created successfully. Setup email sent.',
      };
    } catch (error) {
      this.logger.error(`Failed to create user ${email}`, error);
      
      // Cleanup if something went wrong
      try {
        const existingKeycloakUser = await this.keycloakService.getUserByEmail(email);
        if (existingKeycloakUser) {
          await this.keycloakService.deleteUser(existingKeycloakUser.id);
        }
      } catch (cleanupError) {
        this.logger.error('Failed to cleanup user after error', cleanupError);
      }

      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to create user. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('setup-password')
  async setupPassword(@Query('token') token: string, @Body() { password }: SetupPasswordDto) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    try {
      const keycloakUserId = this.jwtUtil.verifySetup(token);
      await this.keycloakService.setPassword(keycloakUserId, password);
      
      this.logger.log(`Password setup completed for user ID: ${keycloakUserId}`);
      
      return { 
        success: true,
        message: 'Password set successfully. You can now log in.' 
      };
    } catch (error) {
      this.logger.error('Setup password failed', error);
      
      if (error.message === 'Invalid or expired token') {
        throw new BadRequestException('Invalid or expired setup token');
      }
      
      throw new HttpException(
        'Failed to set password. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      const user = await this.keycloakService.getUserByEmail(email);
      // Always return 200 for privacy; send email only if user exists
      if (user) {
        const token = this.jwtUtil.signReset(user.id);
        const link = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
        try {
          await this.mailerService.sendForgotPasswordEmail(email, link);
        } catch (emailError) {
          this.logger.warn('Could not send reset email; link generated');
        }
      }
      return { success: true, message: 'Si un compte existe, un email a été envoyé.' };
    } catch (error) {
      this.logger.warn(`Forgot-password processing failed for ${email}`, error);
      return { success: true, message: 'Si un compte existe, un email a été envoyé.' };
    }
  }

  @Post('reset-password')
  async resetPassword(@Query('token') token: string, @Body('password') password: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    try {
      const keycloakUserId = this.jwtUtil.verifyReset(token);
      await this.keycloakService.setPassword(keycloakUserId, password);
      this.logger.log(`Password reset completed for user ID: ${keycloakUserId}`);
      return { success: true, message: 'Password reset successfully. You can now log in.' };
    } catch (error) {
      this.logger.error('Reset password failed', error);
      throw new BadRequestException('Invalid or expired token');
    }
  }

  @Post('login')
  async login(@Body() { email, password }: LoginDto) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    try {
      const tokenData = await this.keycloakService.login(email, password);
      
      // Get user info from Keycloak
      const keycloakUser = await this.keycloakService.getUserByEmail(email);
      if (!keycloakUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      } 
      
      // Get user roles
      const roles = await this.keycloakService.getUserRoles(keycloakUser.id);
      const primaryRole = this.determinePrimaryRole(roles);

      // Resolve local user ID depending on role
      let localId: string | null = null;
      if (primaryRole === 'commercial') {
        const commercial = await this.commercialService.findByEmail(email);
        localId = commercial?.id ?? null;
      } else if (primaryRole === 'manager') {
        const manager = await this.managerService.findByEmail(email);
        localId = manager?.id ?? null;
      }
      
      this.logger.log(`User logged in successfully: ${email} with role: ${primaryRole}`);
      
      return {
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        user: {
          id: localId || keycloakUser?.id,
          keycloakId: keycloakUser?.id,
          email: keycloakUser?.email,
          firstName: keycloakUser?.firstName,
          lastName: keycloakUser?.lastName,
          role: primaryRole,
        },
      };

    } catch (error) {
      this.logger.error(`Login failed for ${email}`, error);
      
      if (error instanceof HttpException && error.getStatus() === 401) {
        throw error;
      }
      
      throw new HttpException(
        'Login failed. Please check your credentials.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private determinePrimaryRole(roles: string[]): 'admin' | 'manager' | 'commercial' | 'directeur' | 'backoffice' {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('directeur')) return 'directeur';
    if (roles.includes('manager')) return 'manager';
    if (roles.includes('backoffice')) return 'backoffice';
    if (roles.includes('commercial')) return 'commercial';
    
    return 'admin';
  }

  @Post('resend-setup')
  async resendSetup(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      const user = await this.keycloakService.getUserByEmail(email);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const setupToken = this.jwtUtil.signSetup(user.id);
      const setupLink = `${this.configService.get('FRONTEND_URL')}/setup-password?token=${setupToken}`;

      try {
        await this.mailerService.sendSetupPasswordEmail(email, setupLink);
      } catch (emailError) {
        this.logger.warn('Could not send setup email; returning link in response');
      }

      return {
        success: true,
        message: 'Setup link (re)generated',
        setupLink,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to resend setup for ${email}`, error);
      throw new HttpException('Failed to resend setup link', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
