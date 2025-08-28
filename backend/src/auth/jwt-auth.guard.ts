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

}