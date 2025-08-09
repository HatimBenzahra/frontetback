import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  
  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('SMTP_HOST'),
      port: Number(configService.get('SMTP_PORT')),
      secure: false,
      auth: { 
        user: configService.get('SMTP_USER'), 
        pass: configService.get('SMTP_PASS') 
      },
    });
  }
  
  async sendSetupPasswordEmail(to: string, link: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `CRM Prospection <${this.configService.get('SMTP_USER')}>`,
        to,
        subject: 'Définissez votre mot de passe - CRM Prospection',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Bienvenue dans le CRM Prospection !</h2>
            <p>Votre compte a été créé avec succès. Pour accéder à votre espace, vous devez d'abord définir votre mot de passe.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="background: #22c55e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Définir mon mot de passe
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              <strong>Important :</strong> Ce lien expire dans 15 minutes pour des raisons de sécurité.
            </p>
            <p style="color: #666; font-size: 12px;">
              Si vous n'arrivez pas à cliquer sur le bouton, copiez et collez ce lien dans votre navigateur :<br>
              <a href="${link}">${link}</a>
            </p>
          </div>
        `,
      });
      this.logger.log(`Setup password email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send setup email to ${to}`, error);
      throw new Error('Failed to send setup email');
    }
  }
}