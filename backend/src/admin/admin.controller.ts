import { Body, Controller, Post, Delete, Param, BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { KeycloakService } from '../auth/keycloak.service';
import { JwtUtil } from '../auth/jwt.util';
import { MailerService } from '../auth/mailer.service';
import { ConfigService } from '@nestjs/config';
import { CommercialService } from '../commercial/commercial.service';
import { ManagerService } from '../manager/manager.service';
import { DirecteurService } from '../directeur/directeur.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface CreateCommercialWithAuthDto {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  equipeId: string;
  managerId: string;
}

interface CreateManagerWithAuthDto {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
}

interface CreateDirecteurWithAuthDto {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private keycloakService: KeycloakService,
    private jwtUtil: JwtUtil,
    private mailerService: MailerService,
    private configService: ConfigService,
    private commercialService: CommercialService,
    private managerService: ManagerService,
    private directeurService: DirecteurService,
  ) {}

  /**
   * Génère l'URL du frontend avec fallback intelligent
   */
  private getFrontendUrl(): string {
    const localIp = this.configService.get('LOCAL_IP');
    const frontendPort = this.configService.get('FRONTEND_PORT') || '5173';
    return this.configService.get('FRONTEND_URL') || 
      (localIp ? `https://${localIp}:${frontendPort}` : 'https://localhost:5173');
  }

  @Post('commerciaux')
  async createCommercialWithAuth(@Body() dto: CreateCommercialWithAuthDto) {
    const { nom, prenom, email, telephone, equipeId, managerId } = dto;

    if (!nom || !prenom || !email || !equipeId || !managerId) {
      throw new BadRequestException('Tous les champs obligatoires doivent être remplis');
    }

    try {
      // Check if user already exists in Keycloak
      const existingUser = await this.keycloakService.getUserByEmail(email);
      if (existingUser) {
        throw new BadRequestException('Un utilisateur avec cet email existe déjà');
      }

      // Create user in Keycloak first
      const keycloakUserId = await this.keycloakService.createUser({
        email,
        firstName: prenom,
        lastName: nom,
        role: 'commercial',
      });

      // Create commercial in local database
      const commercial = await this.commercialService.create({
        nom,
        prenom,
        email,
        telephone,
        equipeId,
        managerId,
      });

      // Generate setup token and attempt to send email
      const setupToken = this.jwtUtil.signSetup(keycloakUserId);
      const frontendUrl = this.getFrontendUrl();
      const setupLink = `${frontendUrl}/setup-password?token=${setupToken}`;
      this.logger.log(`Setup link generated: ${setupLink}`);

      let emailSent = true;
      try {
        await this.mailerService.sendSetupPasswordEmail(email, setupLink);
      } catch (mailError) {
        emailSent = false;
        this.logger.warn(`Commercial créé mais échec d'envoi d'email: ${email}`);
      }

      this.logger.log(`Commercial créé avec succès: ${email}`);

      return {
        success: true,
        commercial,
        keycloakId: keycloakUserId,
        message: emailSent
          ? 'Commercial créé avec succès. Email de configuration envoyé.'
          : 'Commercial créé avec succès. Échec de l\'envoi de l\'email, utilisez le lien de configuration.',
        setupLink: emailSent ? undefined : setupLink,
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la création du commercial ${email}`, error);
      
      // Cleanup if something went wrong
      try {
        const existingKeycloakUser = await this.keycloakService.getUserByEmail(email);
        if (existingKeycloakUser) {
          await this.keycloakService.deleteUser(existingKeycloakUser.id);
        }
      } catch (cleanupError) {
        this.logger.error('Erreur lors du nettoyage après échec', cleanupError);
      }

      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erreur lors de la création du commercial. Veuillez réessayer.');
    }
  }

  @Post('managers')
  async createManagerWithAuth(@Body() dto: CreateManagerWithAuthDto) {
    const { nom, prenom, email, telephone } = dto;

    if (!nom || !prenom || !email) {
      throw new BadRequestException('Tous les champs obligatoires doivent être remplis');
    }

    try {
      // Check if user already exists in Keycloak
      const existingUser = await this.keycloakService.getUserByEmail(email);
      if (existingUser) {
        throw new BadRequestException('Un utilisateur avec cet email existe déjà');
      }

      // Create user in Keycloak first
      const keycloakUserId = await this.keycloakService.createUser({
        email,
        firstName: prenom,
        lastName: nom,
        role: 'manager',
      });

      // Create manager in local database
      const manager = await this.managerService.create({
        nom,
        prenom,
        email,
        telephone,
      });

      // Generate setup token and attempt to send email
      const setupToken = this.jwtUtil.signSetup(keycloakUserId);
      const frontendUrl = this.getFrontendUrl();
      const setupLink = `${frontendUrl}/setup-password?token=${setupToken}`;
      this.logger.log(`Setup link generated: ${setupLink}`);

      let emailSent = true;
      try {
        await this.mailerService.sendSetupPasswordEmail(email, setupLink);
      } catch (mailError) {
        emailSent = false;
        this.logger.warn(`Manager créé mais échec d'envoi d'email: ${email}`);
      }

      this.logger.log(`Manager créé avec succès: ${email}`);

      return {
        success: true,
        manager,
        keycloakId: keycloakUserId,
        message: emailSent
          ? 'Manager créé avec succès. Email de configuration envoyé.'
          : 'Manager créé avec succès. Échec de l\'envoi de l\'email, utilisez le lien de configuration.',
        setupLink: emailSent ? undefined : setupLink,
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la création du manager ${email}`, error);
      
      // Cleanup if something went wrong
      try {
        const existingKeycloakUser = await this.keycloakService.getUserByEmail(email);
        if (existingKeycloakUser) {
          await this.keycloakService.deleteUser(existingKeycloakUser.id);
        }
      } catch (cleanupError) {
        this.logger.error('Erreur lors du nettoyage après échec', cleanupError);
      }

      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erreur lors de la création du manager. Veuillez réessayer.');
    }
  }

  @Delete('commerciaux/:id')
  async deleteCommercialWithAuth(@Param('id') id: string) {
    try {
      // First get the commercial to get the email
      const commercial = await this.commercialService.findOne(id);
      if (!commercial) {
        throw new BadRequestException('Commercial introuvable');
      }

      // Find and delete user from Keycloak
      const keycloakUser = await this.keycloakService.getUserByEmail(commercial.email);
      if (keycloakUser) {
        await this.keycloakService.deleteUser(keycloakUser.id);
      }

      // Delete from local database
      await this.commercialService.remove(id);

      this.logger.log(`Commercial supprimé: ${commercial.email}`);
      
      return {
        success: true,
        message: 'Commercial supprimé avec succès de Keycloak et de la base de données.',
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression du commercial ${id}`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erreur lors de la suppression du commercial.');
    }
  }

  @Delete('managers/:id')
  async deleteManagerWithAuth(@Param('id') id: string) {
    try {
      // First get the manager to get the email
      const manager = await this.managerService.findOne(id);
      if (!manager) {
        throw new BadRequestException('Manager introuvable');
      }

      // Find and delete user from Keycloak
      const keycloakUser = await this.keycloakService.getUserByEmail(manager.email);
      if (keycloakUser) {
        await this.keycloakService.deleteUser(keycloakUser.id);
      }

      // Delete from local database
      await this.managerService.remove(id);

      this.logger.log(`Manager supprimé: ${manager.email}`);
      
      return {
        success: true,
        message: 'Manager supprimé avec succès de Keycloak et de la base de données.',
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression du manager ${id}`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erreur lors de la suppression du manager.');
    }
  }

  @Post('directeurs')
  async createDirecteurWithAuth(@Body() dto: CreateDirecteurWithAuthDto) {
    const { nom, prenom, email, telephone } = dto;

    if (!nom || !prenom || !email) {
      throw new BadRequestException('Tous les champs obligatoires doivent être remplis');
    }

    try {
      // Check if user already exists in Keycloak
      const existingUser = await this.keycloakService.getUserByEmail(email);
      if (existingUser) {
        throw new BadRequestException('Un utilisateur avec cet email existe déjà');
      }

      // Create user in Keycloak first
      const keycloakUserId = await this.keycloakService.createUser({
        email,
        firstName: prenom,
        lastName: nom,
        role: 'directeur',
      });

      // Create directeur in local database
      const directeur = await this.directeurService.create({
        nom,
        prenom,
        email,
        telephone,
      });

      // Generate setup token and attempt to send email
      const setupToken = this.jwtUtil.signSetup(keycloakUserId);
      const frontendUrl = this.getFrontendUrl();
      const setupLink = `${frontendUrl}/setup-password?token=${setupToken}`;
      this.logger.log(`Setup link generated: ${setupLink}`);

      let emailSent = true;
      try {
        await this.mailerService.sendSetupPasswordEmail(email, setupLink);
      } catch (mailError) {
        emailSent = false;
        this.logger.warn(`Directeur créé mais échec d'envoi d'email: ${email}`);
      }

      this.logger.log(`Directeur créé avec succès: ${email}`);

      return {
        success: true,
        directeur,
        keycloakId: keycloakUserId,
        message: emailSent
          ? 'Directeur créé avec succès. Email de configuration envoyé.'
          : 'Directeur créé avec succès. Échec de l\'envoi de l\'email, utilisez le lien de configuration.',
        setupLink: emailSent ? undefined : setupLink,
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la création du directeur ${email}`, error);
      
      // Cleanup if something went wrong
      try {
        const existingKeycloakUser = await this.keycloakService.getUserByEmail(email);
        if (existingKeycloakUser) {
          await this.keycloakService.deleteUser(existingKeycloakUser.id);
        }
      } catch (cleanupError) {
        this.logger.error('Erreur lors du nettoyage après échec', cleanupError);
      }

      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erreur lors de la création du directeur. Veuillez réessayer.');
    }
  }

  @Delete('directeurs/:id')
  async deleteDirecteurWithAuth(@Param('id') id: string) {
    try {
      // First get the directeur to get the email
      const directeur = await this.directeurService.findOne(id);
      if (!directeur) {
        throw new BadRequestException('Directeur introuvable');
      }

      // Find and delete user from Keycloak
      const keycloakUser = await this.keycloakService.getUserByEmail(directeur.email);
      if (keycloakUser) {
        await this.keycloakService.deleteUser(keycloakUser.id);
      }

      // Delete from local database
      await this.directeurService.remove(id);

      this.logger.log(`Directeur supprimé: ${directeur.email}`);
      
      return {
        success: true,
        message: 'Directeur supprimé avec succès de Keycloak et de la base de données.',
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression du directeur ${id}`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erreur lors de la suppression du directeur.');
    }
  }
}
