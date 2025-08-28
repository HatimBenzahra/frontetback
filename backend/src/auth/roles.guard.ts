import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // Extract roles from Keycloak token
    const userRoles = this.extractRolesFromToken(user);
    
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    
    if (!hasRole) {
      throw new ForbiddenException(`Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }

  private extractRolesFromToken(tokenPayload: any): string[] {
    // Keycloak token structure for realm roles
    if (tokenPayload.realm_access?.roles) {
      return tokenPayload.realm_access.roles;
    }

    // Alternative: check resource_access for client-specific roles
    if (tokenPayload.resource_access) {
      const clientRoles = Object.values(tokenPayload.resource_access)
        .flatMap((client: any) => client.roles || []);
      return clientRoles;
    }

    return [];
  }
}