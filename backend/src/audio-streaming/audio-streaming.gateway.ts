import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface CommercialStreamInfo {
  commercial_id: string;
  commercial_info: any;
  is_streaming: boolean;
  listeners_count: number;
}

interface ActiveConnection {
  socket_id: string;
  role: 'admin' | 'commercial';
  user_info: any;
  listening_to?: string;
  is_streaming?: boolean;
}

@WebSocketGateway({
  namespace: '/audio-streaming',
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',  
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://192.168.1.50:5173',
      'https://192.168.1.50:5173',
      'http://192.168.1.50:3000',
      'https://192.168.1.50:3000',
      process.env.CLIENT_HOST ? `http://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}` : '',
      process.env.CLIENT_HOST ? `https://${process.env.CLIENT_HOST}` : '',
      process.env.CLIENT_HOST ? `https://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}` : '',
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class AudioStreamingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AudioStreamingGateway.name);
  private activeConnections: Map<string, ActiveConnection> = new Map();
  private commercialStreams: Map<string, CommercialStreamInfo> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté: ${client.id}`);
    
    // Envoyer un message de confirmation
    client.emit('connected', {
      message: 'Connecté au serveur de streaming audio',
      sid: client.id,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté: ${client.id}`);
    
    const connection = this.activeConnections.get(client.id);
    if (connection) {
      // Si c'était un commercial qui streamait, notifier la fin du stream
      if (connection.role === 'commercial' && connection.is_streaming) {
        this.commercialStreams.delete(connection.user_info?.id);
        this.server.emit('commercial_stream_ended', {
          commercial_id: connection.user_info?.id,
        });
      }
      
      // Supprimer la connexion
      this.activeConnections.delete(client.id);
    }
  }

  @SubscribeMessage('register_user')
  handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { role: 'admin' | 'commercial'; user_info: any },
  ) {
    this.logger.log(`Enregistrement utilisateur: ${data.role} - ${client.id}`);
    
    this.activeConnections.set(client.id, {
      socket_id: client.id,
      role: data.role,
      user_info: data.user_info,
    });
    
    client.emit('user_registered', {
      message: `Enregistré comme ${data.role}`,
      sid: client.id,
    });

    // Si c'est un admin, envoyer la liste des streams disponibles
    if (data.role === 'admin') {
      const availableStreams = Array.from(this.commercialStreams.values());
      client.emit('available_streams', availableStreams);
    }
  }

  @SubscribeMessage('start_streaming')
  handleStartStreaming(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { commercial_id: string; commercial_info: any },
  ) {
    this.logger.log(`Démarrage du streaming pour: ${data.commercial_id}`);
    
    const connection = this.activeConnections.get(client.id);
    if (!connection || connection.role !== 'commercial') {
      client.emit('streaming_error', {
        error: 'Seuls les commerciaux peuvent démarrer un streaming',
      });
      return;
    }

    // Marquer le commercial comme streamant
    connection.is_streaming = true;
    this.activeConnections.set(client.id, connection);

    // Ajouter/mettre à jour le stream commercial
    this.commercialStreams.set(data.commercial_id, {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info,
      is_streaming: true,
      listeners_count: 0,
    });

    // Notifier tous les admins qu'un nouveau stream est disponible
    this.server.emit('commercial_stream_available', {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info,
    });

    client.emit('streaming_started', {
      message: 'Streaming audio démarré',
      commercial_id: data.commercial_id,
    });
  }

  @SubscribeMessage('stop_streaming')
  handleStopStreaming(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { commercial_id: string },
  ) {
    this.logger.log(`Arrêt du streaming pour: ${data.commercial_id}`);
    
    const connection = this.activeConnections.get(client.id);
    if (!connection || connection.role !== 'commercial') {
      client.emit('streaming_error', {
        error: 'Seuls les commerciaux peuvent arrêter un streaming',
      });
      return;
    }

    // Marquer le commercial comme ne streamant plus
    connection.is_streaming = false;
    this.activeConnections.set(client.id, connection);

    // Supprimer le stream
    this.commercialStreams.delete(data.commercial_id);

    // Notifier tous les clients que le stream est terminé
    this.server.emit('commercial_stream_ended', {
      commercial_id: data.commercial_id,
    });

    client.emit('streaming_stopped', {
      message: 'Streaming audio arrêté',
      commercial_id: data.commercial_id,
    });
  }

  @SubscribeMessage('join_commercial_stream')
  handleJoinCommercialStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { commercial_id: string; admin_info: any },
  ) {
    this.logger.log(`Admin rejoint le stream: ${data.commercial_id}`);
    
    const connection = this.activeConnections.get(client.id);
    if (!connection || connection.role !== 'admin') {
      client.emit('listening_error', {
        error: 'Seuls les admins peuvent écouter les streams',
      });
      return;
    }

    const stream = this.commercialStreams.get(data.commercial_id);
    if (!stream || !stream.is_streaming) {
      client.emit('listening_error', {
        error: 'Stream non disponible',
      });
      return;
    }

    // Marquer l'admin comme écoutant ce commercial
    connection.listening_to = data.commercial_id;
    this.activeConnections.set(client.id, connection);

    // Incrémenter le nombre d'écoutants
    stream.listeners_count++;
    this.commercialStreams.set(data.commercial_id, stream);

    // Rejoindre la room du commercial
    client.join(`commercial_${data.commercial_id}`);

    client.emit('listening_started', {
      message: 'Écoute démarrée',
      commercial_id: data.commercial_id,
    });
  }

  @SubscribeMessage('leave_commercial_stream')
  handleLeaveCommercialStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { commercial_id: string },
  ) {
    this.logger.log(`Admin quitte le stream: ${data.commercial_id}`);
    
    const connection = this.activeConnections.get(client.id);
    if (!connection || connection.role !== 'admin') {
      return;
    }

    // Marquer l'admin comme n'écoutant plus
    connection.listening_to = undefined;
    this.activeConnections.set(client.id, connection);

    const stream = this.commercialStreams.get(data.commercial_id);
    if (stream) {
      // Décrémenter le nombre d'écoutants
      stream.listeners_count = Math.max(0, stream.listeners_count - 1);
      this.commercialStreams.set(data.commercial_id, stream);
    }

    // Quitter la room du commercial
    client.leave(`commercial_${data.commercial_id}`);

    client.emit('listening_stopped', {
      message: 'Écoute arrêtée',
      commercial_id: data.commercial_id,
    });
  }

  @SubscribeMessage('webrtc_offer')
  handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sdp: RTCSessionDescriptionInit },
  ) {
    this.logger.log(`Offre WebRTC reçue de: ${client.id}`);
    
    const connection = this.activeConnections.get(client.id);
    if (!connection || connection.role !== 'commercial') {
      return;
    }

    // Transmettre l'offre à tous les admins qui écoutent ce commercial
    this.server
      .to(`commercial_${connection.user_info?.id}`)
      .emit('webrtc_offer_from_commercial', {
        commercial_id: connection.user_info?.id,
        sdp: data.sdp,
      });
  }

  @SubscribeMessage('webrtc_answer_from_admin')
  handleWebRTCAnswerFromAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { commercial_id: string; sdp: RTCSessionDescriptionInit },
  ) {
    this.logger.log(`Réponse WebRTC reçue d'un admin pour: ${data.commercial_id}`);
    
    // Trouver le socket du commercial
    const commercialConnection = Array.from(this.activeConnections.values()).find(
      conn => conn.role === 'commercial' && conn.user_info?.id === data.commercial_id
    );

    if (commercialConnection) {
      this.server.to(commercialConnection.socket_id).emit('webrtc_answer', {
        sdp: data.sdp,
      });
    }
  }

  @SubscribeMessage('webrtc_ice_candidate_from_admin')
  handleICECandidateFromAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { commercial_id: string; candidate: RTCIceCandidate },
  ) {
    this.logger.log(`Candidat ICE reçu d'un admin pour: ${data.commercial_id}`);
    
    // Transmettre le candidat ICE au commercial
    const commercialConnection = Array.from(this.activeConnections.values()).find(
      conn => conn.role === 'commercial' && conn.user_info?.id === data.commercial_id
    );

    if (commercialConnection) {
      this.server.to(commercialConnection.socket_id).emit('webrtc_ice_candidate', {
        candidate: data.candidate,
      });
    }
  }

  @SubscribeMessage('webrtc_ice_candidate')
  handleICECandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { candidate: RTCIceCandidate },
  ) {
    this.logger.log(`Candidat ICE reçu de: ${client.id}`);
    
    const connection = this.activeConnections.get(client.id);
    if (!connection) {
      return;
    }

    if (connection.role === 'commercial') {
      // Transmettre le candidat ICE aux admins qui écoutent
      this.server
        .to(`commercial_${connection.user_info?.id}`)
        .emit('webrtc_ice_candidate_to_admin', {
          candidate: data.candidate,
        });
    }
  }

  @SubscribeMessage('audio_data')
  handleAudioData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // Simuler le traitement des données audio
    this.logger.debug(`Données audio reçues de ${client.id}`);
    
    client.emit('audio_processed', {
      message: 'Données audio traitées',
      sid: client.id,
    });
  }

  @SubscribeMessage('get_available_streams')
  handleGetAvailableStreams(@ConnectedSocket() client: Socket) {
    const availableStreams = Array.from(this.commercialStreams.values()).filter(
      stream => stream.is_streaming
    );
    
    client.emit('available_streams', availableStreams);
  }

  @SubscribeMessage('get_connection_stats')
  handleGetConnectionStats(@ConnectedSocket() client: Socket) {
    const stats = {
      total_connections: this.activeConnections.size,
      active_streams: this.commercialStreams.size,
      connections_by_role: {
        admin: Array.from(this.activeConnections.values()).filter(c => c.role === 'admin').length,
        commercial: Array.from(this.activeConnections.values()).filter(c => c.role === 'commercial').length,
      },
    };
    
    client.emit('connection_stats', stats);
  }
}