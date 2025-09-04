import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn('No token found in WebSocket handshake');
        throw new UnauthorizedException('No authentication token provided');
      }

      // Créer un objet request-like pour réutiliser le JWT guard existant
      const mockRequest = {
        headers: {
          authorization: `Bearer ${token}`
        },
        user: null
      };

      // Créer un mock context HTTP pour le JWT guard
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      };

      // Utiliser le JWT guard existant pour valider le token
      const isValid = await this.jwtAuthGuard.canActivate(mockContext as ExecutionContext);

      if (isValid && mockRequest.user) {
        // Attacher l'utilisateur au client WebSocket
        client.data.user = mockRequest.user;
        const userInfo = mockRequest.user as any;
        this.logger.debug(`WebSocket authenticated: ${userInfo.email || userInfo.preferred_username}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('WebSocket authentication failed', error.message);
      throw new UnauthorizedException('WebSocket authentication failed');
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Essayer d'extraire le token de plusieurs sources possibles
    const handshake = client.handshake;

    // 1. Depuis le header Authorization
    const authHeader = handshake.headers.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    // 2. Depuis les query parameters
    const tokenFromQuery = handshake.query.token;
    if (tokenFromQuery && typeof tokenFromQuery === 'string') {
      return tokenFromQuery;
    }

    // 3. Depuis l'auth object (utilisé par certains clients)
    const tokenFromAuth = handshake.auth?.token;
    if (tokenFromAuth && typeof tokenFromAuth === 'string') {
      return tokenFromAuth;
    }

    return null;
  }
}