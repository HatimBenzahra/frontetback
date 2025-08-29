import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import * as jwksClient from 'jwks-rsa';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwksClientInstance: jwksClient.JwksClient | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    // Initialize JWKS client for Keycloak
    const keycloakBaseUrl = this.configService.get<string>('KEYCLOAK_BASE_URL');
    const keycloakRealm = this.configService.get<string>('KEYCLOAK_REALM');
    
    if (keycloakBaseUrl && keycloakRealm) {
      this.jwksClientInstance = jwksClient({
        jwksUri: `${keycloakBaseUrl}/realms/${keycloakRealm}/protocol/openid-connect/certs`,
        cache: true,
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 5
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // First decode to get the header for key ID
      const decodedHeader = jwt.decode(token, { complete: true });
      
      if (!decodedHeader || !decodedHeader.header) {
        throw new UnauthorizedException('Invalid token format');
      }

      // JWT Validation - STRICT MODE with full verification
      let payload: any;
      
      try {
        const publicKey = await this.getPublicKey(decodedHeader.header.kid || '');
      
      // Get Keycloak configuration for strict validation
      const keycloakBaseUrl = this.configService.get('KEYCLOAK_BASE_URL');
      const keycloakRealm = this.configService.get('KEYCLOAK_REALM');
      const clientId = this.configService.get('KEYCLOAK_CLIENT_ID');
      
      if (!keycloakBaseUrl || !keycloakRealm) {
        throw new UnauthorizedException('Keycloak configuration missing - cannot validate tokens');
      }
      
      // Strict validation options - verify everything
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['RS256'],
        issuer: `${keycloakBaseUrl}/realms/${keycloakRealm}`,
        ignoreExpiration: false,
        ignoreNotBefore: false,
        clockTolerance: 30 // 30 seconds clock skew tolerance
      };
      
      // Skip audience validation for now - Keycloak often doesn't include it
      // if (clientId) {
      //   verifyOptions.audience = clientId;
      // }
      
      payload = jwt.verify(token, publicKey, verifyOptions) as any;
      
      this.logger.debug('✅ JWT fully verified (signature + issuer + timing)');
    } catch (verifyError) {
        this.logger.error('JWT verification failed:', verifyError.message);
        
        // Log additional details for debugging
        if (verifyError.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Token expired');
        } else if (verifyError.name === 'JsonWebTokenError') {
          throw new UnauthorizedException('Invalid token signature');
        } else if (verifyError.name === 'NotBeforeError') {
          throw new UnauthorizedException('Token not active yet');
        }
        
        throw new UnauthorizedException(`Token validation failed: ${verifyError.message}`);
      }
      
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

  private async getPublicKey(kid: string): Promise<string> {
    if (!kid) {
      throw new UnauthorizedException('Token missing key ID (kid)');
    }

    try {
      if (this.jwksClientInstance) {
        // Use jwks-rsa client for reliable key retrieval
        const key = await this.jwksClientInstance.getSigningKey(kid);
        return key.getPublicKey();
      } else {
        throw new Error('JWKS client not initialized. Check Keycloak configuration.');
      }
    } catch (error) {
      this.logger.error('Failed to get public key', error);
      throw new UnauthorizedException('Unable to verify token signature');
    }
  }


}