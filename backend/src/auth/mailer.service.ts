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
        from: `Groupe FINANSSOR - CRM <${this.configService.get('SMTP_USER')}>`,
        to,
        subject: '🔐 Définissez votre mot de passe - Groupe FINANSSOR CRM',
        html: this.getSetupPasswordTemplate(link),
      });
      this.logger.log(`Setup password email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send setup email to ${to}`, error);
      throw new Error('Failed to send setup email');
    }
  }

  async sendForgotPasswordEmail(to: string, link: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `Groupe FINANSSOR - CRM <${this.configService.get('SMTP_USER')}>`,
        to,
        subject: '🔒 Réinitialisez votre mot de passe - Groupe FINANSSOR CRM',
        html: this.getForgotPasswordTemplate(link),
      });
      this.logger.log(`Reset password email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send reset email to ${to}`, error);
      throw new Error('Failed to send reset email');
    }
  }

  private getSetupPasswordTemplate(link: string): string {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Définissez votre mot de passe</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #4d86df 0%, #A5BDF1 100%); padding: 40px 30px; text-align: center; }
        .logo { width: 200px; height: auto; margin-bottom: 20px; filter: brightness(0) invert(1); }
        .header h1 { color: white; font-size: 28px; font-weight: 700; margin-bottom: 10px; }
        .header p { color: rgba(255,255,255,0.9); font-size: 16px; }
        .content { padding: 40px 30px; }
        .welcome { background: linear-gradient(135deg, #22c55e, #16a34a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 24px; font-weight: 700; margin-bottom: 20px; text-align: center; }
        .message { color: #374151; font-size: 16px; margin-bottom: 30px; text-align: center; }
        .cta-container { text-align: center; margin: 40px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #4d86df, #A5BDF1); color: white; padding: 18px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 8px 25px rgba(77, 134, 223, 0.3); transition: all 0.3s ease; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 12px 35px rgba(77, 134, 223, 0.4); }
        .security-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .security-note h3 { color: #92400e; font-size: 16px; margin-bottom: 8px; }
        .security-note p { color: #78350f; font-size: 14px; }
        .footer { background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { color: #6b7280; font-size: 14px; margin-bottom: 15px; }
        .footer a { color: #4d86df; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .divider { height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin: 30px 0; }
        @media (max-width: 600px) {
            .container { margin: 20px; border-radius: 12px; }
            .header, .content, .footer { padding: 30px 20px; }
            .header h1 { font-size: 24px; }
            .welcome { font-size: 20px; }
            .cta-button { padding: 16px 30px; font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="background: white; display: inline-block; padding: 15px 25px; border-radius: 8px; margin-bottom: 20px;">
                <div style="color: #4d86df; font-size: 24px; font-weight: bold;">Groupe</div>
                <div style="color: #1f2937; font-size: 14px; font-weight: 500; letter-spacing: 2px; margin-top: -5px;">FINANSSOR</div>
            </div>
            <h1>CRM Prospection</h1>
            <p>Votre plateforme de gestion commerciale</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 20px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                    <circle cx="12" cy="12" r="10" fill="#22c55e"/>
                    <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <h2 class="welcome">Bienvenue dans votre espace !</h2>
            
            <p class="message">
                Votre compte a été créé avec succès. Pour accéder à votre espace de travail, 
                vous devez d'abord définir un mot de passe sécurisé.
            </p>
            
            <div class="cta-container">
                <a href="${link}" class="cta-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 8px;">
                        <rect x="3" y="11" width="18" height="10" rx="2" ry="2" fill="white"/>
                        <circle cx="12" cy="16" r="1" fill="#4d86df"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Définir mon mot de passe
                </a>
            </div>
            
            <div class="divider"></div>
            
            <div class="security-note">
                <h3 style="display: flex; align-items: center; margin-bottom: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
                        <path d="M12 9v4" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="17" r="1" fill="#f59e0b"/>
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Important - Sécurité
                </h3>
                <p>
                    Ce lien expire dans <strong>15 minutes</strong> pour garantir la sécurité de votre compte. 
                    Si le lien a expiré, contactez votre administrateur pour en recevoir un nouveau.
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p style="display: flex; align-items: center; justify-content: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#4d86df" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Vous avez des difficultés ? <a href="mailto:support@finanssor.com">Contactez notre support</a>
            </p>
            <p style="font-size: 12px; color: #9ca3af;">
                Si vous n'arrivez pas à cliquer sur le bouton, copiez ce lien dans votre navigateur :<br>
                <a href="${link}" style="word-break: break-all;">${link}</a>
            </p>
            <div class="divider"></div>
            <p style="font-size: 12px; color: #9ca3af;">
                © 2024 Groupe FINANSSOR. Tous droits réservés.<br>
                Cet email a été envoyé de manière automatique, merci de ne pas y répondre.
            </p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private getForgotPasswordTemplate(link: string): string {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisez votre mot de passe</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #4d86df 0%, #A5BDF1 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: white; font-size: 28px; font-weight: 700; margin-bottom: 10px; }
        .header p { color: rgba(255,255,255,0.9); font-size: 16px; }
        .content { padding: 40px 30px; }
        .title { background: linear-gradient(135deg, #dc2626, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 24px; font-weight: 700; margin-bottom: 20px; text-align: center; }
        .message { color: #374151; font-size: 16px; margin-bottom: 30px; text-align: center; }
        .cta-container { text-align: center; margin: 40px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #4d86df, #A5BDF1); color: white; padding: 18px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 8px 25px rgba(77, 134, 223, 0.3); transition: all 0.3s ease; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 12px 35px rgba(77, 134, 223, 0.4); }
        .security-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .security-note h3 { color: #92400e; font-size: 16px; margin-bottom: 8px; }
        .security-note p { color: #78350f; font-size: 14px; }
        .footer { background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { color: #6b7280; font-size: 14px; margin-bottom: 15px; }
        .footer a { color: #4d86df; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .divider { height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin: 30px 0; }
        .warning-box { background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center; }
        .warning-box p { color: #dc2626; font-size: 14px; }
        @media (max-width: 600px) {
            .container { margin: 20px; border-radius: 12px; }
            .header, .content, .footer { padding: 30px 20px; }
            .header h1 { font-size: 24px; }
            .title { font-size: 20px; }
            .cta-button { padding: 16px 30px; font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="background: white; display: inline-block; padding: 15px 25px; border-radius: 8px; margin-bottom: 20px;">
                <div style="color: #4d86df; font-size: 24px; font-weight: bold;">Groupe</div>
                <div style="color: #1f2937; font-size: 14px; font-weight: 500; letter-spacing: 2px; margin-top: -5px;">FINANSSOR</div>
            </div>
            <h1>CRM Prospection</h1>
            <p>Réinitialisation de mot de passe</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 20px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                    <circle cx="12" cy="12" r="10" fill="#dc2626"/>
                    <path d="M12 8v4M12 16h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <h2 class="title">Réinitialisation demandée</h2>
            
            <p class="message">
                Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte. 
                Si vous êtes à l'origine de cette demande, cliquez sur le bouton ci-dessous.
            </p>
            
            <div class="cta-container">
                <a href="${link}" class="cta-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 8px;">
                        <path d="M3 12l2-2 4 4 8-8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        <path d="M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c1.5 0 2.9.4 4.1 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                    Réinitialiser mon mot de passe
                </a>
            </div>
            
            <div class="divider"></div>
            
            <div class="warning-box">
                <p style="display: flex; align-items: flex-start;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px; margin-top: 2px; flex-shrink: 0;">
                        <path d="M12 9v4M12 17h.01" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="10" stroke="#dc2626" stroke-width="2" fill="none"/>
                    </svg>
                    <span>
                        <strong>Vous n'avez pas demandé cette réinitialisation ?</strong><br>
                        Ignorez cet email. Votre mot de passe actuel reste inchangé et sécurisé.
                    </span>
                </p>
            </div>
            
            <div class="security-note">
                <h3 style="display: flex; align-items: center; margin-bottom: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
                        <path d="M12 9v4" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="17" r="1" fill="#f59e0b"/>
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Important - Sécurité
                </h3>
                <p>
                    Ce lien expire dans <strong>15 minutes</strong> pour garantir la sécurité de votre compte. 
                    Après expiration, vous devrez refaire une demande de réinitialisation.
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p style="display: flex; align-items: center; justify-content: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#4d86df" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Vous avez des difficultés ? <a href="mailto:support@finanssor.com">Contactez notre support</a>
            </p>
            <p style="font-size: 12px; color: #9ca3af;">
                Si vous n'arrivez pas à cliquer sur le bouton, copiez ce lien dans votre navigateur :<br>
                <a href="${link}" style="word-break: break-all;">${link}</a>
            </p>
            <div class="divider"></div>
            <p style="font-size: 12px; color: #9ca3af;">
                © 2024 Groupe FINANSSOR. Tous droits réservés.<br>
                Cet email a été envoyé de manière automatique, merci de ne pas y répondre.
            </p>
        </div>
    </div>
</body>
</html>
    `;
  }
}