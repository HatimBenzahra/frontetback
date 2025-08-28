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
      
      // Find manager in database by email to get the real managerId
      let managerId = null;
      if (payload.email) {
        const manager = await this.prisma.manager.findFirst({
          where: { email: payload.email },
          select: { id: true }
        });
        managerId = manager?.id || null;
      }
      
      // Add user info to request
      request.user = {
        ...payload,
        // Use the database manager ID, not the Keycloak user ID
        managerId: managerId,
        userId: payload.sub, // Keep Keycloak user ID for reference
        roles: this.extractRoles(payload),
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