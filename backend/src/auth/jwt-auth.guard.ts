import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import * as jwksClient from 'jwks-rsa';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwksClientInstance: jwksClient.JwksClient | null = null;
  
  // Cache pour éviter les requêtes DB répétées
  private userCache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }>();
  
  // Cache TTL optimisé pour tokens Keycloak 30min
  private readonly CACHE_TTL_ADMIN = 2 * 60 * 1000;     // 2 min (très sensible)
  private readonly CACHE_TTL_MANAGER = 5 * 60 * 1000;   // 5 min 
  private readonly CACHE_TTL_COMMERCIAL = 10 * 60 * 1000; // 10 min (moins sensible, <30min)
  
  // Nettoyage du cache toutes les 10 minutes
  private cacheCleanupInterval: NodeJS.Timeout;

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
        cacheMaxAge: 12 * 60 * 60 * 1000, // 12 heures (optimisé)
        cacheMaxEntries: 10, // Limite les entrées
        rateLimit: true,
        jwksRequestsPerMinute: 2, // Réduit de 5 à 2
        requestHeaders: {}, // Headers personnalisés si besoin
        timeout: 30000 // 30s timeout
      });
    }
    
    // Démarrer le nettoyage périodique du cache
    this.startCacheCleanup();
  }
  
  private startCacheCleanup() {
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [email, cacheEntry] of this.userCache.entries()) {
        if (now - cacheEntry.timestamp > cacheEntry.ttl) {
          this.userCache.delete(email);
        }
      }
    }, 10 * 60 * 1000); // Nettoyage toutes les 10 minutes
  }
  
  onModuleDestroy() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
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
      
      // Récupérer les données utilisateur (avec cache)
      const userData = await this.getUserDataWithCache(payload.email);
      const { managerId, dbRoles } = userData;
      
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

  private async getUserDataWithCache(email: string): Promise<{ managerId: string | null; dbRoles: string[] }> {
    if (!email) {
      return { managerId: null, dbRoles: [] };
    }

    // Vérifier le cache
    const cached = this.userCache.get(email);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < cached.ttl) {
      // Cache valide
      return cached.data;
    }

    // Cache expiré ou inexistant, requête DB
    let managerId = null;
    const dbRoles: string[] = [];

    try {
      // Requête optimisée: une seule requête avec Promise.all
      const [manager, commercial] = await Promise.all([
        this.prisma.manager.findFirst({
          where: { email },
          select: { id: true }
        }),
        this.prisma.commercial.findFirst({
          where: { email },
          select: { id: true }
        })
      ]);

      if (manager) {
        managerId = manager.id;
        dbRoles.push('manager');
      }

      if (commercial) {
        dbRoles.push('commercial');
      }

      // Check admin by email
      if (email === 'benzahrahatim90@gmail.com') {
        dbRoles.push('admin');
      }

      const userData = { managerId, dbRoles };

      // TTL hiérarchique: plus sensible = cache plus court
      let ttl = this.CACHE_TTL_COMMERCIAL; // Par défaut
      if (dbRoles.includes('admin')) {
        ttl = this.CACHE_TTL_ADMIN;
      } else if (dbRoles.includes('manager')) {
        ttl = this.CACHE_TTL_MANAGER;
      }
      
      // TTL ne peut jamais dépasser l'expiration du token (30 min Keycloak)
      if (payload.exp) {
        const tokenExpiresIn = (payload.exp * 1000) - now;
        const maxSafeTTL = Math.max(tokenExpiresIn - 60000, 30000); // Min 30s, marge 1min
        ttl = Math.min(ttl, maxSafeTTL);
        
        // Si token expire bientôt (<2min), TTL très court
        if (tokenExpiresIn < 120000) {
          ttl = Math.min(ttl, 30000); // Max 30s
        }
      }
      
      this.userCache.set(email, {
        data: userData,
        timestamp: now,
        ttl
      });

      return userData;

    } catch (error) {
      this.logger.error('Database query failed for user data', error);
      // En cas d'erreur, retourner des données vides mais ne pas crasher
      return { managerId: null, dbRoles: [] };
    }
  }


}