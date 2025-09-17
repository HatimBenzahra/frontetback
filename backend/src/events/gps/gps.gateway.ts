import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Inject } from '@nestjs/common';
import { websocketConfig } from '../websocket.config';
import { WsAuthGuard } from '../../auth/ws-auth.guard';
import { WsRolesGuard } from '../../auth/ws-roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CommercialService } from '../../manager-space/commercial/commercial.service';

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
@UseGuards(WsAuthGuard)
export class GpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(CommercialService) private readonly commercialService: CommercialService
  ) {}

  // Stocker les positions des commerciaux en mémoire
  private commercialLocations = new Map<string, LocationUpdateData>();
  private commercialSockets = new Map<string, string>(); // commercialId -> socketId
  private commercialLastSeen = new Map<string, number>(); // commercialId -> timestamp
  private offlineTimers = new Map<string, NodeJS.Timeout>(); // commercialId -> timeout

  handleConnection(client: Socket) {
    console.log(`🌍 GPS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🌍 GPS client disconnected: ${client.id}`);
    
    // Trouver le commercial associé à cette socket
    const commercialId = Array.from(this.commercialSockets.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    
    if (commercialId) {
      this.commercialSockets.delete(commercialId);
      
      // Ne pas supprimer immédiatement les données GPS, attendre un délai réduit
      const offlineTimer = setTimeout(() => {
        console.log(`📍 Commercial ${commercialId} marqué comme hors ligne après délai`);
        this.commercialLocations.delete(commercialId);
        this.commercialLastSeen.delete(commercialId);
        this.offlineTimers.delete(commercialId);
        this.broadcastCommercialOffline(commercialId).catch(error => {
          console.error('Erreur lors de la diffusion de déconnexion:', error);
          this.server.to('gps-tracking').emit('commercialOffline', commercialId);
        });
      }, 15000); // 15 secondes de délai (réduit de 30s)
      
      this.offlineTimers.set(commercialId, offlineTimer);
      console.log(`📍 Commercial ${commercialId} déconnecté, délai de 15s avant marquage hors ligne`);
    }
  }

  // Nettoyer les ressources
  onModuleDestroy() {
    // Nettoyer tous les timers de déconnexion
    this.offlineTimers.forEach(timer => clearTimeout(timer));
    this.offlineTimers.clear();
  }

  @SubscribeMessage('locationUpdate')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  async handleLocationUpdate(client: Socket, data: LocationUpdateData) {
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

    // Diffuser la mise à jour aux admins et managers autorisés
    try {
      await this.broadcastLocationUpdate(data);
    } catch (error) {
      console.error('Erreur lors de la diffusion filtrée, utilisation fallback:', error);
      // Fallback: diffuser à tous (comportement original)
      this.server.to('gps-tracking').emit('locationUpdate', data);
    }
  }

  @SubscribeMessage('locationError')
  async handleLocationError(_client: Socket, data: LocationErrorData) {
    console.log(`❌ Erreur GPS pour ${data.commercialId}:`, data.error);
    
    // Diffuser l'erreur aux admins et managers autorisés
    try {
      await this.broadcastLocationError(data);
    } catch (error) {
      console.error('Erreur lors de la diffusion d\'erreur GPS filtrée, fallback:', error);
      this.server.to('gps-tracking').emit('locationError', data);
    }
  }

  @SubscribeMessage('commercialOffline')
  async handleCommercialOffline(_client: Socket, commercialId: string) {
    console.log(`📍 Commercial ${commercialId} se déconnecte`);
    
    this.commercialLocations.delete(commercialId);
    this.commercialSockets.delete(commercialId);
    
    // Notifier les admins et managers autorisés
    try {
      await this.broadcastCommercialOffline(commercialId);
    } catch (error) {
      console.error('Erreur lors de la diffusion de déconnexion commerciale filtrée, fallback:', error);
      this.server.to('gps-tracking').emit('commercialOffline', commercialId);
    }
  }

  @SubscribeMessage('request_gps_state')
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager')
  async handleRequestGPSState(client: Socket) {
    console.log(`📍 Demande d'état GPS de ${client.id}`);
    
    const user = client.data.user;
    console.log(`👤 User demandant l'état GPS:`, {
      userId: user?.userId,
      roles: user?.roles,
      managerId: user?.managerId,
      socketId: client.id,
      rawUser: user
    });

    const isAdmin = user?.roles?.includes('admin');
    const managerId = user?.managerId;

    if (isAdmin) {
      // Admin: envoyer toutes les positions
      this.commercialLocations.forEach((location, _commercialId) => {
        client.emit('locationUpdate', location);
      });
      console.log(`📍 État GPS envoyé (admin): ${this.commercialLocations.size} commerciaux`);
    } else if (managerId) {
      // Manager: filtrer selon ses commerciaux
      try {
        const managerCommerciaux = await this.commercialService.getManagerCommerciaux(managerId);
        const commercialIds = managerCommerciaux.map(c => c.id);
        console.log(`🔍 Manager ${managerId} a accès à ${commercialIds.length} commerciaux:`, commercialIds);
        
        let sentCount = 0;
        this.commercialLocations.forEach((location, commercialId) => {
          if (commercialIds.includes(commercialId)) {
            client.emit('locationUpdate', location);
            sentCount++;
            console.log(`✅ Position envoyée pour commercial ${commercialId}`);
          }
        });
        
        console.log(`📍 État GPS envoyé (manager ${managerId}): ${sentCount}/${this.commercialLocations.size} commerciaux`);
      } catch (error) {
        console.error(`Erreur lors de la récupération des commerciaux pour manager ${managerId}:`, error);
      }
    } else {
      console.log(`📍 Accès GPS refusé pour ${client.id}: utilisateur non identifié`);
    }
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

  // Diffuser une mise à jour de position avec filtrage par permissions
  private async broadcastLocationUpdate(data: LocationUpdateData) {
    const room = this.server.sockets.adapter.rooms.get('gps-tracking');
    if (!room) {
      console.log('❌ Aucune room gps-tracking trouvée');
      return;
    }

    // Récupérer le managerId du commercial pour savoir à quel manager il appartient
    const commercialManagerId = await this.commercialService.getCommercialManagerId(data.commercialId);
    console.log(`🔍 Commercial ${data.commercialId} appartient au manager ${commercialManagerId}`);

    for (const socketId of room) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) continue;

      const user = socket.data.user;
      console.log(`👤 User connecté:`, {
        userId: user?.userId,
        roles: user?.roles,
        managerId: user?.managerId,
        socketId: socketId,
        rawUser: user
      });

      const isAdmin = user?.roles?.includes('admin');
      const managerId = user?.managerId;

      // Admin peut tout voir
      if (isAdmin) {
        console.log(`✅ Envoi position à admin ${user?.userId}`);
        socket.emit('locationUpdate', data);
        continue;
      }

      // Manager ne peut voir que ses commerciaux
      if (managerId && commercialManagerId === managerId) {
        console.log(`✅ Envoi position à manager ${managerId} pour son commercial`);
        socket.emit('locationUpdate', data);
      } else {
        console.log(`❌ Position non envoyée - manager ${managerId} n'a pas accès au commercial ${data.commercialId}`);
      }
    }
  }

  // Diffuser une erreur GPS avec filtrage par permissions
  private async broadcastLocationError(data: LocationErrorData) {
    const room = this.server.sockets.adapter.rooms.get('gps-tracking');
    if (!room) return;

    try {
      const commercialManagerId = await this.commercialService.getCommercialManagerId(data.commercialId);

      for (const socketId of room) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (!socket) continue;

        const user = socket.data.user;
        const isAdmin = user?.roles?.includes('admin');
        const managerId = user?.managerId;

        if (isAdmin || (managerId && commercialManagerId === managerId)) {
          socket.emit('locationError', data);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la diffusion d\'erreur GPS filtrée, fallback:', error);
      // Fallback: diffuser à tous
      this.server.to('gps-tracking').emit('locationError', data);
    }
  }

  // Diffuser une déconnexion commercial avec filtrage par permissions
  private async broadcastCommercialOffline(commercialId: string) {
    const room = this.server.sockets.adapter.rooms.get('gps-tracking');
    if (!room) return;

    try {
      const commercialManagerId = await this.commercialService.getCommercialManagerId(commercialId);

      for (const socketId of room) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (!socket) continue;

        const user = socket.data.user;
        const isAdmin = user?.roles?.includes('admin');
        const managerId = user?.managerId;

        if (isAdmin || (managerId && commercialManagerId === managerId)) {
          socket.emit('commercialOffline', commercialId);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la diffusion de déconnexion commerciale filtrée, fallback:', error);
      // Fallback: diffuser à tous
      this.server.to('gps-tracking').emit('commercialOffline', commercialId);
    }
  }
}