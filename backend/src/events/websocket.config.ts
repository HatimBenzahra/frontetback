/**
 * Configuration centralisée pour toutes les adresses IP et CORS
 * ⚠️  TOUTES LES ADRESSES IP DOIVENT ÊTRE DÉFINIES ICI ⚠️
 */
export class CentralizedConfig {
  // Configuration des IPs depuis les variables d'environnement - AUCUN FALLBACK HARDCODÉ
  private static readonly LOCAL_IP = process.env.LOCAL_IP;
  private static readonly PRODUCTION_IP = process.env.PRODUCTION_IP;
  private static readonly STAGING_IP = process.env.STAGING_IP;
  private static readonly FRONTEND_PORT = process.env.FRONTEND_PORT;
  private static readonly API_PORT = process.env.API_PORT;
  // LOCAL_LLM_URL supprimé - utilisation de Gemini API maintenant
  
  // Configuration des réseaux autorisés (optionnel)
  private static readonly ALLOWED_NETWORKS = process.env.ALLOWED_NETWORKS; // Ex: "192.168.0.0/16,10.0.0.0/8"

  /**
   * Vérifie si une IP appartient aux réseaux autorisés
   */
  private static isIpInAllowedNetworks(ip: string): boolean {
    if (!this.ALLOWED_NETWORKS) {
      return false; // Aucun réseau autorisé si pas défini
    }

    const networks = this.ALLOWED_NETWORKS.split(',').map(net => net.trim());
    
    for (const network of networks) {
      if (this.isIpInNetwork(ip, network)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Vérifie si une IP appartient à un réseau CIDR
   */
  private static isIpInNetwork(ip: string, network: string): boolean {
    try {
      const [networkIp, prefixLength] = network.split('/');
      const prefix = parseInt(prefixLength);
      
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(networkIp);
      const mask = (0xffffffff << (32 - prefix)) >>> 0;
      
      return (ipNum & mask) === (networkNum & mask);
    } catch (error) {
      console.warn(`Erreur lors de la vérification du réseau ${network}:`, error);
      return false;
    }
  }

  /**
   * Convertit une IP en nombre
   */
  private static ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * Vérifie si une IP appartient à un réseau privé
   */
  private static isPrivateNetwork(ip: string): boolean {
    try {
      const ipNum = this.ipToNumber(ip);

      // 192.168.0.0/16
      if ((ipNum & 0xFFFF0000) === 0xC0A80000) return true;

      // 10.0.0.0/8
      if ((ipNum & 0xFF000000) === 0x0A000000) return true;

      // 172.16.0.0/12
      if ((ipNum & 0xFFF00000) === 0xAC100000) return true;

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extrait l'IP d'une URL
   */
  private static extractIpFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return null;
    }
  }

  /**
   * Génère toutes les URLs autorisées pour CORS
   * ⚠️  UNIQUEMENT depuis les variables d'environnement
   */
  static getAllowedOrigins(): string[] {
    const allowed: string[] = [];
    
    // URLs locales (seulement si définies dans .env)
    if (this.LOCAL_IP && this.FRONTEND_PORT) {
      allowed.push(`http://${this.LOCAL_IP}:${this.FRONTEND_PORT}`);
      allowed.push(`https://${this.LOCAL_IP}:${this.FRONTEND_PORT}`);
    }
    
    // URLs de production (seulement si définies dans .env)
    if (this.PRODUCTION_IP) {
      allowed.push(`http://${this.PRODUCTION_IP}`);
      allowed.push(`https://${this.PRODUCTION_IP}`);
    }
    
    // URLs de staging (seulement si définies dans .env)
    if (this.STAGING_IP) {
      allowed.push(`http://${this.STAGING_IP}`);
      allowed.push(`https://${this.STAGING_IP}`);
    }
    
    return allowed.filter(Boolean);
  }

  /**
   * Fonction de validation CORS centralisée
   * Plus permissive pour le développement
   */
  static corsOriginValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Autoriser les requêtes sans origine (apps mobiles, curl)
    if (!origin) return callback(null, true);

    const allowed = this.getAllowedOrigins();

    // Vérifier si l'origine est dans la liste autorisée
    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    // Vérifier si l'IP appartient aux réseaux autorisés (configurable via .env)
    const ip = this.extractIpFromUrl(origin);
    if (ip && this.isIpInAllowedNetworks(ip)) {
      return callback(null, true);
    }

    // Mode développement : autoriser localhost et réseaux privés
    if (process.env.NODE_ENV !== 'production') {
      if (ip) {
        // Autoriser localhost sous toutes ses formes
        if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
          return callback(null, true);
        }

        // Autoriser les réseaux privés (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (this.isPrivateNetwork(ip)) {
          return callback(null, true);
        }
      }
    }

    console.warn(`CORS: Origin non autorisée: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  };

  /**
   * Configuration CORS centralisée
   */
  static getCorsConfig() {
    return {
      origin: this.corsOriginValidator,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'Pragma'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };
  }

  /**
   * Configuration WebSocket centralisée
   */
  static getWebSocketConfig() {
    return {
      cors: {
        origin: this.corsOriginValidator,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    };
  }

  /**
   * Génère l'URL du frontend - UNIQUEMENT depuis les variables d'environnement
   */
  static getFrontendUrl(): string {
    if (process.env.FRONTEND_URL) {
      return process.env.FRONTEND_URL;
    }
    
    if (this.LOCAL_IP && this.FRONTEND_PORT) {
      return `https://${this.LOCAL_IP}:${this.FRONTEND_PORT}`;
    }
    
    throw new Error('FRONTEND_URL ou (LOCAL_IP + FRONTEND_PORT) doivent être définis dans .env');
  }

  /**
   * Génère l'URL de l'API backend - UNIQUEMENT depuis les variables d'environnement
   */
  static getApiUrl(): string {
    if (process.env.API_URL) {
      return process.env.API_URL;
    }
    
    if (this.LOCAL_IP && this.API_PORT) {
      return `https://${this.LOCAL_IP}:${this.API_PORT}`;
    }
    
    throw new Error('API_URL ou (LOCAL_IP + API_PORT) doivent être définis dans .env');
  }

  /**
   * Retourne la clé API Gemini - UNIQUEMENT depuis les variables d'environnement
   */
  static getGeminiApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY doit être défini dans .env');
    }
    return apiKey;
  }

  /**
   * Retourne les chemins SSL pour les certificats
   * ⚠️  Les noms de fichiers SSL sont hardcodés car ils correspondent aux certificats générés
   */
  static getSslPaths() {
    const sslPath = process.env.NODE_ENV === 'production' 
      ? 'ssl'
      : 'ssl';
    
    return {
      keyPath: `${sslPath}/127.0.0.1+4-key.pem`,
      certPath: `${sslPath}/127.0.0.1+4.pem`,
    };
  }

  /**
   * Génère les informations de debug pour les logs
   */
  static getDebugInfo() {
    return {
      corsOrigins: this.getAllowedOrigins().join(', '),
      frontendUrl: this.getFrontendUrl(),
      apiUrl: this.getApiUrl(),
      geminiApiKey: process.env.GEMINI_API_KEY ? '✅ Défini' : '❌ Manquant',
      environment: process.env.NODE_ENV || 'development',
      allowedNetworks: this.ALLOWED_NETWORKS || 'Aucun réseau autorisé',
      // Informations sur les variables d'environnement
      envVars: {
        LOCAL_IP: this.LOCAL_IP ? '✅ Défini' : '❌ Manquant',
        PRODUCTION_IP: this.PRODUCTION_IP ? '✅ Défini' : '❌ Manquant',
        STAGING_IP: this.STAGING_IP ? '✅ Défini' : '❌ Manquant',
        FRONTEND_PORT: this.FRONTEND_PORT ? '✅ Défini' : '❌ Manquant',
        API_PORT: this.API_PORT ? '✅ Défini' : '❌ Manquant',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✅ Défini' : '❌ Manquant',
        ALLOWED_NETWORKS: this.ALLOWED_NETWORKS ? '✅ Défini' : '❌ Manquant',
      }
    };
  }
}

// Export de la configuration WebSocket pour compatibilité
export const websocketConfig = CentralizedConfig.getWebSocketConfig();