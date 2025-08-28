import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private publicKeyCache: { key: string; expiry: number } | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // First decode without verification to get the payload structure
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded) {
        throw new UnauthorizedException('Invalid token format');
      }

      // For development, we can skip verification and just extract the payload
      // In production, you should verify against Keycloak's public key
      const payload = decoded.payload as any;
      
      // Find user in database by email to get role and managerId
      let managerId = null;
      let dbRoles: string[] = [];
      
      if (payload.email) {
        // Check if user is a manager
        const manager = await this.prisma.manager.findFirst({
          where: { email: payload.email },
          select: { id: true }
        });
        
        if (manager) {
          managerId = manager.id;
          dbRoles.push('manager');
        }
        
        // Check if user is a commercial
        const commercial = await this.prisma.commercial.findFirst({
          where: { email: payload.email },
          select: { id: true }
        });
        
        if (commercial) {
          dbRoles.push('commercial');
        }
        
        // Check if user is admin (you can create an admin table or check by email)
        // For now, check if email matches admin pattern or create admin logic
        if (payload.email === 'benzahrahatim90@gmail.com') {
          dbRoles.push('admin');
        }
      }
      
      // Combine Keycloak roles with database roles
      const keycloakRoles = this.extractRoles(payload);
      const allRoles = [...new Set([...keycloakRoles, ...dbRoles])];
      
      // Add user info to request
      request.user = {
        ...payload,
        // Use the database manager ID, not the Keycloak user ID
        managerId: managerId,
        userId: payload.sub, // Keep Keycloak user ID for reference
        roles: allRoles,
        email: payload.email,
        preferredUsername: payload.preferred_username,
      };

      this.logger.debug(`User authenticated: ${payload.preferred_username || payload.email}`);
      return true;
    } catch (error) {
      this.logger.error('Token validation failed', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractRoles(payload: any): string[] {
    // Extract roles from Keycloak token structure
    const realmRoles = payload.realm_access?.roles || [];
    const resourceRoles: string[] = [];
    
    // Extract client-specific roles if needed
    if (payload.resource_access) {
      Object.values(payload.resource_access).forEach((client: any) => {
        if (client.roles) {
          resourceRoles.push(...client.roles);
        }
      });
    }
    
    return [...realmRoles, ...resourceRoles];
  }

  // For production use - verify with Keycloak public key
  private async verifyWithKeycloak(token: string): Promise<any> {
    try {
      const publicKey = await this.getKeycloakPublicKey();
      return jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: `${this.configService.get('KEYCLOAK_BASE_URL')}/realms/${this.configService.get('KEYCLOAK_REALM')}`,
      });
    } catch (error) {
      throw new UnauthorizedException('Token verification failed');
    }
  }

  private async getKeycloakPublicKey(): Promise<string> {
    // Use cache if available and not expired
    if (this.publicKeyCache && Date.now() < this.publicKeyCache.expiry) {
      return this.publicKeyCache.key;
    }

    try {
      const response = await axios.get(
        `${this.configService.get('KEYCLOAK_BASE_URL')}/realms/${this.configService.get('KEYCLOAK_REALM')}/protocol/openid_connect/certs`,
        { timeout: 5000 }
      );
      
      const key = response.data.keys[0];
      if (!key) {
        throw new Error('No public key found in Keycloak response');
      }

      // In production, convert JWK to PEM properly
      // For now, return a placeholder that would work in development
      const publicKeyPem = this.convertJwkToPem(key);
      
      // Cache for 1 hour
      this.publicKeyCache = {
        key: publicKeyPem,
        expiry: Date.now() + 60 * 60 * 1000
      };

      return publicKeyPem;
    } catch (error) {
      this.logger.error('Failed to fetch Keycloak public key', error.message);
      throw new UnauthorizedException('Unable to verify token with authentication server');
    }
  }

  private convertJwkToPem(jwk: any): string {
    // This is a simplified placeholder - in production use a proper JWK to PEM library
    // For example: npm install jwk-to-pem
    return `-----BEGIN PUBLIC KEY-----\n${jwk.x5c?.[0] || jwk.n}\n-----END PUBLIC KEY-----`;
  }
}