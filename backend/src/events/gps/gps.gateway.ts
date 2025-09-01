import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { websocketConfig } from '../websocket.config';

interface LocationUpdateData {
  commercialId: string;
  position: [number, number];
  timestamp: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

interface LocationErrorData {
  commercialId: string;
  error: string;
  timestamp: string;
}

@WebSocketGateway(websocketConfig)
export class GpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Stocker les positions des commerciaux en mémoire
  private commercialLocations = new Map<string, LocationUpdateData>();
  private commercialSockets = new Map<string, string>(); // commercialId -> socketId
  private commercialLastSeen = new Map<string, number>(); // commercialId -> timestamp
  private offlineTimers = new Map<string, NodeJS.Timeout>(); // commercialId -> timeout

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`🌍 GPS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🌍 GPS client disconnected: ${client.id}`);
    
    // Trouver le commercial associé à cette socket
    const commercialId = Array.from(this.commercialSockets.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    
    if (commercialId) {
      this.commercialSockets.delete(commercialId);
      
      // Ne pas supprimer immédiatement les données GPS, attendre un délai
      const offlineTimer = setTimeout(() => {
        console.log(`📍 Commercial ${commercialId} marqué comme hors ligne après délai`);
        this.commercialLocations.delete(commercialId);
        this.commercialLastSeen.delete(commercialId);
        this.offlineTimers.delete(commercialId);
        this.server.to('gps-tracking').emit('commercialOffline', commercialId);
      }, 30000); // 30 secondes de délai
      
      this.offlineTimers.set(commercialId, offlineTimer);
      console.log(`📍 Commercial ${commercialId} déconnecté, délai de 30s avant marquage hors ligne`);
    }
  }

  // Nettoyer les ressources
  onModuleDestroy() {
    // Nettoyer tous les timers de déconnexion
    this.offlineTimers.forEach(timer => clearTimeout(timer));
    this.offlineTimers.clear();
  }

  @SubscribeMessage('locationUpdate')
  handleLocationUpdate(client: Socket, data: LocationUpdateData) {
    console.log(`📍 Position reçue de ${data.commercialId}:`, {
      lat: data.position[0],
      lng: data.position[1],
      speed: data.speed
    });

    // Stocker la position et mettre à jour le timestamp
    this.commercialLocations.set(data.commercialId, data);
    this.commercialSockets.set(data.commercialId, client.id);
    this.commercialLastSeen.set(data.commercialId, Date.now());

    // Annuler le timer de déconnexion s'il existe
    const existingTimer = this.offlineTimers.get(data.commercialId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.offlineTimers.delete(data.commercialId);
    }

    // Diffuser la mise à jour aux admins
    this.server.to('gps-tracking').emit('locationUpdate', data);
  }

  @SubscribeMessage('locationError')
  handleLocationError(client: Socket, data: LocationErrorData) {
    console.log(`❌ Erreur GPS pour ${data.commercialId}:`, data.error);
    
    // Diffuser l'erreur aux admins
    this.server.to('gps-tracking').emit('locationError', data);
  }

  @SubscribeMessage('commercialOffline')
  handleCommercialOffline(client: Socket, commercialId: string) {
    console.log(`📍 Commercial ${commercialId} se déconnecte`);
    
    this.commercialLocations.delete(commercialId);
    this.commercialSockets.delete(commercialId);
    
    // Notifier les admins
    this.server.to('gps-tracking').emit('commercialOffline', commercialId);
  }

  @SubscribeMessage('request_gps_state')
  handleRequestGPSState(client: Socket) {
    console.log(`📍 Demande d'état GPS de ${client.id}`);
    
    // Envoyer toutes les positions actuelles
    this.commercialLocations.forEach((location, commercialId) => {
      client.emit('locationUpdate', location);
    });
    
    console.log(`📍 État GPS envoyé: ${this.commercialLocations.size} commerciaux`);
  }

  // Méthodes utilitaires pour l'accès depuis l'extérieur
  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  getAllLocations(): LocationUpdateData[] {
    return Array.from(this.commercialLocations.values());
  }

  getCommercialLocation(commercialId: string): LocationUpdateData | undefined {
    return this.commercialLocations.get(commercialId);
  }

  isCommercialOnline(commercialId: string): boolean {
    return this.commercialSockets.has(commercialId);
  }

  getCommercialLastSeen(commercialId: string): number | undefined {
    return this.commercialLastSeen.get(commercialId);
  }
}