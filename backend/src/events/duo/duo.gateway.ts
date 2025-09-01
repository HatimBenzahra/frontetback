import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { websocketConfig } from '../websocket.config';

interface DuoInvitation {
  requestId: string;
  requesterName: string;
  requesterPrenom: string;
  immeubleAdresse: string;
  immeubleVille: string;
  immeubleId: string;
  timestamp: string;
}


@WebSocketGateway(websocketConfig)
export class DuoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map userId -> socketId pour retrouver les utilisateurs connectés
  private connectedUsers = new Map<string, string>();
  
  // Map requestId -> requester socketId pour les réponses
  private pendingInvitations = new Map<string, string>();

  handleConnection(client: Socket) {
    console.log(`👥 Duo client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`👥 Duo client disconnected: ${client.id}`);
    
    // Nettoyer les utilisateurs connectés
    const disconnectedUser = Array.from(this.connectedUsers.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    if (disconnectedUser) {
      this.connectedUsers.delete(disconnectedUser);
      console.log(`🗑️ User ${disconnectedUser} retiré de la liste duo`);
    }
  }

  @SubscribeMessage('duo_user_connected')
  handleUserConnected(client: Socket, data: { userId: string; userInfo: { nom: string; prenom: string } }) {
    console.log(`👥 User ${data.userId} (${data.userInfo.prenom} ${data.userInfo.nom}) connecté au système DUO`);
    
    this.connectedUsers.set(data.userId, client.id);
    
    client.emit('duo_user_connected_ack', {
      success: true,
      message: 'Connecté au système d\'invitations DUO'
    });
  }

  @SubscribeMessage('duo_invitation_sent')
  handleDuoInvitationSent(client: Socket, data: {
    requestId: string;
    partnerId: string;
    requesterName: string;
    requesterPrenom: string;
    immeubleAdresse: string;
    immeubleVille: string;
    immeubleId: string;
  }) {
    console.log(`📩 Invitation DUO envoyée: ${data.requesterPrenom} ${data.requesterName} invite partenaire ${data.partnerId}`);
    
    // Enregistrer l'invitation en attente
    this.pendingInvitations.set(data.requestId, client.id);
    
    // Trouver le socket du partenaire
    const partnerSocketId = this.connectedUsers.get(data.partnerId);
    
    if (partnerSocketId) {
      console.log(`📤 Envoi notification à ${data.partnerId} via socket ${partnerSocketId}`);
      
      const invitation: DuoInvitation = {
        requestId: data.requestId,
        requesterName: data.requesterName,
        requesterPrenom: data.requesterPrenom,
        immeubleAdresse: data.immeubleAdresse,
        immeubleVille: data.immeubleVille,
        immeubleId: data.immeubleId,
        timestamp: new Date().toISOString()
      };
      
      // Envoyer la notification au partenaire
      this.server.to(partnerSocketId).emit('duo_invitation_received', invitation);
      
      // Confirmer à l'expéditeur que la notification a été envoyée
      client.emit('duo_invitation_delivered', {
        requestId: data.requestId,
        delivered: true,
        message: 'Notification envoyée au partenaire'
      });
    } else {
      console.log(`⚠️ Partenaire ${data.partnerId} non connecté au WebSocket`);
      
      // Informer l'expéditeur que le partenaire n'est pas en ligne
      client.emit('duo_invitation_delivered', {
        requestId: data.requestId,
        delivered: false,
        message: 'Le partenaire n\'est pas connecté actuellement'
      });
    }
  }

  @SubscribeMessage('duo_invitation_response')
  handleDuoInvitationResponse(client: Socket, data: {
    requestId: string;
    accepted: boolean;
    responderName?: string;
    responderPrenom?: string;
  }) {
    console.log(`📨 Réponse invitation DUO: ${data.requestId} = ${data.accepted ? 'ACCEPTÉ' : 'REFUSÉ'}`);
    
    // Trouver le socket de l'expéditeur original
    const requesterSocketId = this.pendingInvitations.get(data.requestId);
    
    if (requesterSocketId) {
      console.log(`📤 Envoi réponse au requester via socket ${requesterSocketId}`);
      
      // Envoyer la réponse au requester
      this.server.to(requesterSocketId).emit('duo_invitation_answered', {
        requestId: data.requestId,
        accepted: data.accepted,
        responderName: data.responderName,
        responderPrenom: data.responderPrenom,
        timestamp: new Date().toISOString()
      });
      
      // Nettoyer l'invitation en attente
      this.pendingInvitations.delete(data.requestId);
      
      // Confirmer au répondeur
      client.emit('duo_response_sent', {
        requestId: data.requestId,
        success: true,
        message: 'Réponse envoyée avec succès'
      });
    } else {
      console.log(`⚠️ Requester pour l'invitation ${data.requestId} non trouvé`);
      
      client.emit('duo_response_sent', {
        requestId: data.requestId,
        success: false,
        message: 'Expéditeur de l\'invitation introuvable'
      });
    }
  }

  @SubscribeMessage('duo_request_status')
  handleDuoRequestStatus(client: Socket) {
    console.log(`🔍 Demande de statut DUO de ${client.id}`);
    
    // Trouver l'utilisateur connecté
    const userId = Array.from(this.connectedUsers.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    
    const connectedUsersCount = this.connectedUsers.size;
    const pendingInvitationsCount = this.pendingInvitations.size;
    
    client.emit('duo_status_response', {
      userId,
      connected: !!userId,
      connectedUsersCount,
      pendingInvitationsCount,
      timestamp: new Date().toISOString()
    });
  }

  // Méthodes utilitaires pour l'accès depuis l'extérieur
  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  // Méthode pour notifier manuellement une invitation (si appelée depuis un service)
  notifyDuoInvitation(partnerId: string, invitation: DuoInvitation) {
    const partnerSocketId = this.connectedUsers.get(partnerId);
    if (partnerSocketId) {
      this.server.to(partnerSocketId).emit('duo_invitation_received', invitation);
      return true;
    }
    return false;
  }

  // Méthode pour notifier une réponse (si appelée depuis un service)
  notifyDuoResponse(requesterId: string, response: any) {
    const requesterSocketId = this.connectedUsers.get(requesterId);
    if (requesterSocketId) {
      this.server.to(requesterSocketId).emit('duo_invitation_answered', response);
      return true;
    }
    return false;
  }
}