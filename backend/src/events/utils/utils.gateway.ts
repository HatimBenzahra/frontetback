import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { websocketConfig } from '../websocket.config';

@WebSocketGateway(websocketConfig)
export class UtilsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`🔧 Utils client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔧 Utils client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, room: string) {
    client.join(room);
    console.log(`📡 Client ${client.id} joined room: ${room}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(client: Socket, room: string) {
    client.leave(room);
    console.log(`📡 Client ${client.id} left room: ${room}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, startTime: number) {
    // Renvoyer immédiatement le timestamp pour calculer la latence
    client.emit('pong', startTime);
  }

  @SubscribeMessage('request_commercials_status')
  handleRequestCommercialsStatus(client: Socket) {
    console.log(`👥 Demande de statut des commerciaux de ${client.id}`);
    
    // Cette méthode nécessiterait l'accès aux autres gateways
    // Pour l'instant, on renvoie un état vide
    client.emit('commercials_status_response', {
      status: []
    });
  }

  // Méthodes utilitaires pour l'accès depuis l'extérieur
  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }
}