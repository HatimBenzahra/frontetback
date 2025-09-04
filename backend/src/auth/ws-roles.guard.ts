import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Socket } from 'socket.io';

@Injectable()
export class WsRolesGuard implements CanActivate {
  private readonly logger = new Logger(WsRolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const client = context.switchToWs().getClient<Socket>();
    const user = client.data.user;
    
    if (!user) {
      this.logger.warn('User not found in WebSocket client data');
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));
    
    if (!hasRole) {
      this.logger.warn(`User ${user.email} missing required roles: ${requiredRoles.join(', ')}`);
      throw new ForbiddenException(`Required roles: ${requiredRoles.join(', ')}`);
    }

    this.logger.debug(`User ${user.email} authorized with roles: ${user.roles?.join(', ')}`);
    return true;
  }
}