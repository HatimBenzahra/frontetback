import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { websocketConfig } from '../websocket.config';
import { WsAuthGuard } from '../../auth/ws-auth.guard';
import { WsRolesGuard } from '../../auth/ws-roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { UseGuards } from '@nestjs/common';

@WebSocketGateway(websocketConfig)
export class PortesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Portes client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Portes client disconnected: ${client.id}`);
  }
  @SubscribeMessage('porte:update')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handlePorteUpdate(client: Socket, data: { porteId: string; updates: any }) {
    console.log(`Mise à jour de porte: ${data.porteId}`, data.updates);
    
    // Diffuser la mise à jour à tous les clients dans la même room (même immeuble)
    const rooms = Array.from(client.rooms);
    const buildingRoom = rooms.find(room => room !== client.id);
    
    if (buildingRoom) {
      this.server.to(buildingRoom).emit('porte:updated', {
        porteId: data.porteId,
        updates: data.updates,
        updatedBy: client.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('porte:statusChanged')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handlePorteStatusChange(client: Socket, data: { porteId: string; statut: string; assigneeId?: string }) {
    console.log(`Changement de statut de porte: ${data.porteId} -> ${data.statut}`);
    
    // Diffuser le changement de statut à tous les clients dans la même room
    const rooms = Array.from(client.rooms);
    const buildingRoom = rooms.find(room => room !== client.id);
    
    if (buildingRoom) {
      this.server.to(buildingRoom).emit('porte:statusChanged', {
        porteId: data.porteId,
        statut: data.statut,
        assigneeId: data.assigneeId,
        changedBy: client.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('porte:assign')
  @UseGuards(WsRolesGuard)
  @Roles('commercial', 'manager')
  handlePorteAssign(client: Socket, data: { porteId: string; assigneeId: string }) {
    console.log(`Assignation de porte: ${data.porteId} -> ${data.assigneeId}`);
    
    const rooms = Array.from(client.rooms);
    const buildingRoom = rooms.find(room => room !== client.id);
    
    if (buildingRoom) {
      this.server.to(buildingRoom).emit('porte:assigned', {
        porteId: data.porteId,
        assigneeId: data.assigneeId,
        assignedBy: client.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('porte:added')
  @UseGuards(WsRolesGuard)
  @Roles('admin')
  handlePorteAdded(client: Socket, data: { porte: any }) {
    console.log(`Ajout de porte: ${data.porte.id}`);
    
    const rooms = Array.from(client.rooms);
    const buildingRoom = rooms.find(room => room !== client.id);
    
    if (buildingRoom) {
      this.server.to(buildingRoom).emit('porte:added', {
        porte: data.porte,
        addedBy: client.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('porte:deleted')  
  @UseGuards(WsRolesGuard)
  @Roles('admin')
  handlePorteDeleted(client: Socket, data: { porteId: string }) {
    console.log(`🚪 Suppression de porte: ${data.porteId}`);
    
    const rooms = Array.from(client.rooms);
    const buildingRoom = rooms.find(room => room !== client.id);
    
    if (buildingRoom) {
      this.server.to(buildingRoom).emit('porte:deleted', {
        porteId: data.porteId,
        deletedBy: client.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('floor:added')
  @UseGuards(WsRolesGuard)
  @Roles('admin')
  handleFloorAdded(client: Socket, data: { newNbEtages: number }) {
    console.log(`Ajout d'étage: ${data.newNbEtages} étages total`);
    
    const rooms = Array.from(client.rooms);
    const buildingRoom = rooms.find(room => room !== client.id);
    
    if (buildingRoom) {
      this.server.to(buildingRoom).emit('floor:added', {
        newNbEtages: data.newNbEtages,
        addedBy: client.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Méthodes utilitaires pour l'accès depuis l'extérieur
  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }
}