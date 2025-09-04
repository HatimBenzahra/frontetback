import { io, Socket } from 'socket.io-client';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

class LocationService {
  private socket: Socket | null = null;
  private watchId: number | null = null;
  private commercialId: string | null = null;
  private isTracking = false;
  private heartbeatInterval: number | null = null;
  private lastPosition: LocationData | null = null;
  
  // Throttling GPS adaptatif
  private lastPositionSent: number = 0;
  private isMoving: boolean = false;
  private lastMovementCheck: number = 0;
  private positionHistory: LocationData[] = [];
  
  // Seuils adaptatifs selon mouvement
  private readonly MOVING_TIME_INTERVAL = 10000;     // 10s si mouvement
  private readonly STATIONARY_TIME_INTERVAL = 60000; // 60s si immobile
  private readonly MIN_DISTANCE_MOVING = 10;         // 10m si mouvement
  private readonly MIN_DISTANCE_STATIONARY = 20;     // 20m si immobile
  private readonly SPEED_THRESHOLD = 0.5;           // 0.5 m/s = seuil mouvement
  private readonly MAX_ACCURACY = 100;              // Précision max acceptable

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const API_PORT = import.meta.env.VITE_API_PORT || '3000';
    
    // Use different URLs for development vs production
    const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');
    const socketUrl = isDevelopment ? `https://${SERVER_HOST}:${API_PORT}` : `https://${SERVER_HOST}`;
    console.log('🔌 Initialisation socket GPS:', socketUrl);
    
    // Get auth token from localStorage
    const token = localStorage.getItem('access_token');
    
    this.socket = io(socketUrl, {
      secure: true,
      transports: ['polling', 'websocket'], // Polling en premier pour mobile
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true, // Force une nouvelle connexion
      rejectUnauthorized: false, // Accepter les certificats auto-signés
      auth: {
        token: token
      },
      query: {
        token: token
      }
    });

    this.socket.on('connect', () => {
      console.log('📍 Service GPS connecté');
      if (this.commercialId) {
        this.socket?.emit('joinRoom', 'gps-tracking');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('📍 Service GPS déconnecté:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.log('❌ Erreur connexion GPS:', error.message);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 GPS reconnecté après', attemptNumber, 'tentatives');
      if (this.commercialId) {
        this.socket?.emit('joinRoom', 'gps-tracking');
      }
    });

    this.socket.on('reconnect_failed', () => {
      console.log('❌ Impossible de reconnecter le GPS');
    });
  }

  async startTracking(commercialId: string): Promise<boolean> {
    if (this.isTracking && this.commercialId === commercialId) {
      console.log('📍 Suivi GPS déjà actif pour ce commercial');
      return true;
    }

    // Si on change de commercial, arrêter l'ancien suivi
    if (this.isTracking) {
      this.stopTracking();
    }

    this.commercialId = commercialId;

    // Vérifier si la géolocalisation est supportée
    if (!navigator.geolocation) {
      console.error('❌ Géolocalisation non supportée par ce navigateur');
      return false;
    }

    // Vérifier HTTPS sur mobile
    if (!window.location.protocol.startsWith('https') && window.location.hostname !== 'localhost') {
      console.error('❌ HTTPS requis pour la géolocalisation sur mobile');
      alert('La géolocalisation nécessite une connexion sécurisée (HTTPS)');
      return false;
    }

    try {
      console.log('📍 Tentative d\'accès à la géolocalisation...');
      
      // S'assurer que le socket est connecté
      if (!this.socket?.connected) {
        console.log('🔄 Attente de la connexion socket...');
        await new Promise<void>((resolve) => {
          if (this.socket?.connected) {
            resolve();
          } else {
            this.socket?.once('connect', () => resolve());
            // Timeout après 10 secondes
            setTimeout(() => resolve(), 10000);
          }
        });
      }

      // Rejoindre la room GPS
      this.socket?.emit('joinRoom', 'gps-tracking');
      
      // Tentative directe d'obtenir la position (cela déclenchera la demande de permission)
      const position = await this.getCurrentPositionWithRetry();
      console.log('✅ Permission GPS accordée et position obtenue');

      // Envoyer la position initiale
      this.sendLocationUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        speed: position.coords.speed || undefined,
        heading: position.coords.heading || undefined,
      }, false);

      // Démarrer le suivi en temps réel
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
          };

          this.sendLocationUpdate(locationData, false);
        },
        (error) => {
          console.error('Erreur de géolocalisation:', error.message);
          this.handleLocationError(error);
        },
        {
          // Options optimisées et précision limitée
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 120000,
        }
      );

      this.isTracking = true;
      console.log('Suivi GPS démarré pour commercial:', commercialId);
      
      // Démarrer le heartbeat pour maintenir la connexion
      this.startHeartbeat();
      
      return true;

    } catch (error) {
      console.error('Impossible d\'obtenir la position:', error);
      return false;
    }
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Arrêter le heartbeat
    this.stopHeartbeat();

    if (this.socket && this.commercialId) {
      this.socket.emit('commercialOffline', this.commercialId);
    }

    this.isTracking = false;
    this.commercialId = null;
    this.lastPosition = null;
    this.positionHistory = [];
    this.isMoving = false;
    this.lastMovementCheck = 0;
    this.lastPositionSent = 0;
    console.log('📍 Suivi GPS arrêté');
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true, // Précision élevée pour éviter POSITION_UNAVAILABLE
          timeout: 60000, // 60 secondes - plus long timeout
          maximumAge: 60000, // Cache de 1 minute seulement
        }
      );
    });
  }

  private async getCurrentPositionWithRetry(maxRetries = 5): Promise<GeolocationPosition> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`📍 Tentative GPS ${i + 1}/${maxRetries}...`);
        
        // Configuration progressive : d'abord haute précision, puis dégradée
        const options = {
          enableHighAccuracy: i < 2, // Haute précision pour les 2 premières tentatives
          timeout: 45000 + (i * 15000), // Timeout croissant: 45s, 60s, 75s...
          maximumAge: i === 0 ? 0 : 300000, // Pas de cache pour la première tentative
        };
        
        console.log(`Configuration tentative ${i + 1}:`, options);
        
        return await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
      } catch (error) {
        console.log(`Tentative ${i + 1} échouée:`, error);
        
        // Analyser le type d'erreur
        if (error instanceof GeolocationPositionError) {
          if (error.code === error.PERMISSION_DENIED) {
            // Permission refusée, pas la peine de réessayer
            throw error;
          }
        }
        
        if (i === maxRetries - 1) {
          throw error; // Dernière tentative, on lance l'erreur
        }
        
        // Attendre progressivement plus longtemps entre les tentatives
        const delay = 2000 + (i * 1000); // 2s, 3s, 4s, 5s
        console.log(`⏱️ Attente ${delay}ms avant la prochaine tentative...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Toutes les tentatives ont échoué');
  }

  private sendLocationUpdate(locationData: LocationData, isHeartbeat = false) {
    if (!this.socket || !this.commercialId) return;

    const now = Date.now();
    
    // Rejeter si précision trop faible
    if (locationData.accuracy > this.MAX_ACCURACY) {
      console.log(`📍 Position ignorée (précision: ${locationData.accuracy}m > ${this.MAX_ACCURACY}m)`);
      return;
    }

    // Détecter le mouvement
    this.updateMovementStatus(locationData);
    
    // Throttling adaptatif selon mouvement (sauf heartbeat)
    if (!isHeartbeat && this.lastPosition) {
      const timeThreshold = this.isMoving ? this.MOVING_TIME_INTERVAL : this.STATIONARY_TIME_INTERVAL;
      const distanceThreshold = this.isMoving ? this.MIN_DISTANCE_MOVING : this.MIN_DISTANCE_STATIONARY;
      
      // Vérifier le délai adaptatif
      if (now - this.lastPositionSent < timeThreshold) {
        console.log(`📍 Position ignorée (throttling: ${this.isMoving ? 'mouvement' : 'immobile'})`);
        return;
      }
      
      // Vérifier la distance adaptative
      const distance = this.calculateDistance(
        this.lastPosition.latitude, this.lastPosition.longitude,
        locationData.latitude, locationData.longitude
      );
      
      if (distance < distanceThreshold) {
        console.log(`📍 Position ignorée (distance: ${distance.toFixed(1)}m < ${distanceThreshold}m, ${this.isMoving ? 'mouvement' : 'immobile'})`);
        return;
      }
    }

    // Sauvegarder la dernière position pour le heartbeat
    this.lastPosition = locationData;
    this.lastPositionSent = now;

    const updateData = {
      commercialId: this.commercialId,
      position: [locationData.latitude, locationData.longitude] as [number, number],
      timestamp: new Date(locationData.timestamp).toISOString(),
      speed: locationData.speed,
      heading: locationData.heading,
      accuracy: locationData.accuracy,
    };

    this.socket.emit('locationUpdate', updateData);
    console.log(`📍 Position envoyée${isHeartbeat ? ' (heartbeat)' : ''}:`, updateData);
  }
  
  // Calcul de distance entre deux points GPS (formule haversine)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance en mètres
  }
  
  // Détection du mouvement basée sur vitesse et historique
  private updateMovementStatus(locationData: LocationData) {
    const now = Date.now();
    
    // Ajouter à l'historique (garder 3 dernières positions)
    this.positionHistory.push(locationData);
    if (this.positionHistory.length > 3) {
      this.positionHistory.shift();
    }
    
    // Vérifier seulement toutes les 30 secondes
    if (now - this.lastMovementCheck < 30000) {
      return;
    }
    this.lastMovementCheck = now;
    
    let isCurrentlyMoving = false;
    
    // Méthode 1: Vitesse GPS si disponible
    if (locationData.speed && locationData.speed > this.SPEED_THRESHOLD) {
      isCurrentlyMoving = true;
    }
    
    // Méthode 2: Calculer vitesse depuis historique si pas de vitesse GPS
    if (!isCurrentlyMoving && this.positionHistory.length >= 2) {
      const recent = this.positionHistory[this.positionHistory.length - 1];
      const previous = this.positionHistory[this.positionHistory.length - 2];
      
      const distance = this.calculateDistance(
        previous.latitude, previous.longitude,
        recent.latitude, recent.longitude
      );
      
      const timeDiff = (recent.timestamp - previous.timestamp) / 1000; // secondes
      const calculatedSpeed = timeDiff > 0 ? distance / timeDiff : 0;
      
      if (calculatedSpeed > this.SPEED_THRESHOLD) {
        isCurrentlyMoving = true;
      }
    }
    
    // Mettre à jour le statut avec hystérésis
    if (isCurrentlyMoving !== this.isMoving) {
      this.isMoving = isCurrentlyMoving;
      console.log(`🚶 Statut mouvement: ${this.isMoving ? 'EN MOUVEMENT' : 'IMMOBILE'}`);
    }
  }

  private startHeartbeat() {
    // Arrêter le heartbeat existant s'il y en a un
    this.stopHeartbeat();

    // Heartbeat adaptatif selon mouvement
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected && this.commercialId && this.lastPosition) {
        const now = Date.now();
        // Heartbeat plus fréquent si immobile (rassurer l'admin)
        const heartbeatThreshold = this.isMoving ? 120000 : 60000; // 2min si mouvement, 1min si immobile
        
        if (now - this.lastPositionSent > heartbeatThreshold) {
          this.sendLocationUpdate(this.lastPosition, true);
          console.log(`💓 Heartbeat GPS envoyé (${this.isMoving ? 'mouvement' : 'immobile'})`);
        }
      }
    }, 60000); // Vérification toutes les minutes

    console.log('💓 Heartbeat GPS démarré (adaptatif)');
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Heartbeat GPS arrêté');
    }
  }

  private handleLocationError(error: GeolocationPositionError) {
    let message = '';
    let shouldRetry = false;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Permission de géolocalisation refusée';
        this.showLocationInstructions();
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Position non disponible - Vérifiez que le GPS est activé et que vous êtes à l\'extérieur';
        shouldRetry = true;
        break;
      case error.TIMEOUT:
        message = 'Timeout de géolocalisation - Tentative de reconnexion...';
        shouldRetry = true;
        break;
      default:
        message = 'Erreur de géolocalisation inconnue';
        break;
    }

    console.error('Erreur GPS:', message, error);
    
    // Tentative de récupération automatique pour certaines erreurs
    if (shouldRetry && this.isTracking) {
      console.log('🔄 Tentative de récupération GPS dans 10 secondes...');
      setTimeout(() => {
        if (this.isTracking && this.commercialId) {
          console.log('🔄 Redémarrage du suivi GPS...');
          // Redémarrer le tracking
          this.getCurrentPositionWithRetry()
            .then(position => {
              console.log('✅ GPS récupéré avec succès');
              this.sendLocationUpdate({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
                speed: position.coords.speed || undefined,
                heading: position.coords.heading || undefined,
              }, false);
            })
            .catch(retryError => {
              console.error('Impossible de récupérer le GPS:', retryError);
            });
        }
      }, 10000);
    }
    
    // Notifier l'admin que le commercial a un problème GPS
    if (this.socket && this.commercialId) {
      this.socket.emit('locationError', {
        commercialId: this.commercialId,
        error: message,
        timestamp: new Date().toISOString(),
        shouldRetry,
      });
    }
  }

  getTrackingStatus() {
    return {
      isTracking: this.isTracking,
      commercialId: this.commercialId,
      isConnected: this.socket?.connected || false,
    };
  }

  // Méthode pour tester la géolocalisation
  async testGeolocation(): Promise<boolean> {
    try {
      const position = await this.getCurrentPosition();
      console.log('🧪 Test GPS réussi:', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      return true;
    } catch (error) {
      console.error('🧪 Test GPS échoué:', error);
      return false;
    }
  }

  // Méthode pour guider l'utilisateur sur l'activation GPS
  showLocationInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS) {
      instructions = `
INSTRUCTIONS POUR iOS:
1. Ouvrez Réglages > Confidentialité et sécurité > Service de localisation
2. Activez "Service de localisation"
3. Trouvez Safari dans la liste et sélectionnez "Lors de l'utilisation de l'app"
4. Rechargez cette page et autorisez l'accès à la localisation
      `.trim();
    } else if (isAndroid) {
      instructions = `
INSTRUCTIONS POUR ANDROID:
1. Ouvrez Paramètres > Applications > Chrome (ou votre navigateur)
2. Appuyez sur "Autorisations"
3. Activez "Position"
4. Rechargez cette page et autorisez l'accès à la localisation
      `.trim();
    } else {
      instructions = `
INSTRUCTIONS:
1. Cliquez sur l'icône de localisation dans la barre d'adresse
2. Sélectionnez "Toujours autoriser" ou "Autoriser"
3. Rechargez la page si nécessaire
      `.trim();
    }
    
    console.log(instructions);
    alert(instructions);
  }
}

export const locationService = new LocationService();