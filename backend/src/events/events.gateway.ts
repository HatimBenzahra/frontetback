import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

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

interface TranscriptionSession {
  id: string;
  commercial_id: string;
  commercial_name: string;
  start_time: string;
  end_time: string;
  full_transcript: string;
  duration_seconds: number;
}

@WebSocketGateway({
  cors: {
    origin: [
      `https://${process.env.LOCALHOST_DEV}:${process.env.FRONTEND_PORT}`, 
      `https://127.0.0.1:${process.env.FRONTEND_PORT}`,
      `https://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}`,
      `https://${process.env.LOCALHOST_IP}:${process.env.FRONTEND_PORT}`,
      `http://${process.env.LOCALHOST_DEV}:${process.env.FRONTEND_PORT}`, 
      `http://127.0.0.1:${process.env.FRONTEND_PORT}`,
      `http://${process.env.CLIENT_HOST}:${process.env.FRONTEND_PORT}`,
      `http://${process.env.LOCALHOST_IP}:${process.env.FRONTEND_PORT}`
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Stocker les positions des commerciaux en mémoire
  private commercialLocations = new Map<string, LocationUpdateData>();
  private commercialSockets = new Map<string, string>(); // commercialId -> socketId
  private activeStreams = new Map<string, { commercial_id: string; commercial_info: any; socket_id: string }>(); // commercialId -> stream info + socket id
  
  // Gestion des sessions de transcription
  private activeTranscriptionSessions = new Map<string, TranscriptionSession>(); // commercialId -> session en cours
  private transcriptionHistory: TranscriptionSession[] = []; // Historique des sessions

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`📡 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`📡 Client disconnected: ${client.id}`);
    
    // Trouver le commercial associé à cette socket
    const commercialId = Array.from(this.commercialSockets.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    
    if (commercialId) {
      this.commercialSockets.delete(commercialId);
      this.commercialLocations.delete(commercialId);
      
      // Nettoyer aussi l'état de streaming si le commercial était en train de streamer
      if (this.activeStreams.has(commercialId)) {
        console.log(`🎤 Commercial ${commercialId} se déconnecte pendant le streaming`);
        this.activeStreams.delete(commercialId);
        this.server.to('audio-streaming').emit('stop_streaming', { commercial_id: commercialId });
      }
      
      this.server.to('gps-tracking').emit('commercialOffline', commercialId);
      console.log(`📍 Commercial ${commercialId} hors ligne`);
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, room: string) {
    client.join(room);
    console.log(`📡 Client ${client.id} joined room: ${room}`);
    
    // Si c'est la room de tracking GPS, envoyer les positions actuelles
    if (room === 'gps-tracking') {
      this.commercialLocations.forEach((location, commercialId) => {
        client.emit('locationUpdate', location);
      });
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(client: Socket, room: string) {
    client.leave(room);
    console.log(`📡 Client ${client.id} left room: ${room}`);
  }

  @SubscribeMessage('locationUpdate')
  handleLocationUpdate(client: Socket, data: LocationUpdateData) {
    console.log(`📍 Position reçue de ${data.commercialId}:`, {
      lat: data.position[0],
      lng: data.position[1],
      speed: data.speed
    });

    // Stocker la position
    this.commercialLocations.set(data.commercialId, data);
    this.commercialSockets.set(data.commercialId, client.id);

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

  // Gestion des événements audio streaming
  @SubscribeMessage('start_streaming')
  handleStartStreaming(client: Socket, data: { commercial_id: string; commercial_info?: any }) {
    console.log(`🎤 Commercial ${data.commercial_id} démarre le streaming`);
    
    // Stocker l'état du stream actif
    this.activeStreams.set(data.commercial_id, {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info || {},
      socket_id: client.id,
    });
    
    // Créer une nouvelle session de transcription
    const sessionId = `${data.commercial_id}_${Date.now()}`;
    const session: TranscriptionSession = {
      id: sessionId,
      commercial_id: data.commercial_id,
      commercial_name: data.commercial_info?.name || 'Commercial',
      start_time: new Date().toISOString(),
      end_time: '',
      full_transcript: '',
      duration_seconds: 0
    };
    
    this.activeTranscriptionSessions.set(data.commercial_id, session);
    console.log(`📝 Session de transcription créée pour ${data.commercial_id}:`, sessionId);
    
    // Diffuser aux admins dans la room audio-streaming avec socket_id
    this.server.to('audio-streaming').emit('start_streaming', {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info || {},
      socket_id: client.id,
    });
  }

  @SubscribeMessage('stop_streaming')
  handleStopStreaming(client: Socket, data: { commercial_id: string }) {
    console.log(`🎤 Commercial ${data.commercial_id} arrête le streaming`);
    
    // Supprimer l'état du stream actif
    this.activeStreams.delete(data.commercial_id);
    
    // Terminer la session de transcription
    const session = this.activeTranscriptionSessions.get(data.commercial_id);
    if (session) {
      session.end_time = new Date().toISOString();
      const startTime = new Date(session.start_time);
      const endTime = new Date(session.end_time);
      session.duration_seconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      
      // Ajouter à l'historique
      this.transcriptionHistory.push(session);
      console.log(`📝 Session de transcription terminée pour ${data.commercial_id}:`, {
        duration: session.duration_seconds,
        transcript_length: session.full_transcript.length
      });
      
      // Supprimer de la session active
      this.activeTranscriptionSessions.delete(data.commercial_id);
      
      // Notifier les admins de la nouvelle session dans l'historique
      this.server.to('audio-streaming').emit('transcription_session_completed', session);
    }
    
    // Diffuser aux admins dans la room audio-streaming
    this.server.to('audio-streaming').emit('stop_streaming', data);
  }

  // Gestion de la demande de synchronisation des streams
  @SubscribeMessage('request_streaming_status')
  handleRequestStreamingStatus(client: Socket) {
    console.log(`🔄 Demande de synchronisation des streams actifs de ${client.id}`);
    
    const activeStreamsArray = Array.from(this.activeStreams.values());
    console.log(`🔄 Streams actifs:`, activeStreamsArray);
    
    // Envoyer l'état actuel des streams au client qui demande
    client.emit('streaming_status_response', {
      active_streams: activeStreamsArray
    });
  }

  // --- WebRTC signaling relay for listen-only ---
  @SubscribeMessage('suivi:webrtc_offer')
  handleSuiviOffer(client: Socket, data: { to_socket_id: string; sdp: string; type: string }) {
    console.log(`📨 Offer from ${client.id} to ${data.to_socket_id}`);
    this.server.to(data.to_socket_id).emit('suivi:webrtc_offer', {
      from_socket_id: client.id,
      sdp: data.sdp,
      type: data.type,
    });
  }

  @SubscribeMessage('suivi:webrtc_answer')
  handleSuiviAnswer(client: Socket, data: { to_socket_id: string; sdp: string; type: string }) {
    console.log(`📨 Answer from ${client.id} to ${data.to_socket_id}`);
    this.server.to(data.to_socket_id).emit('suivi:webrtc_answer', {
      from_socket_id: client.id,
      sdp: data.sdp,
      type: data.type,
    });
  }

  @SubscribeMessage('suivi:webrtc_ice_candidate')
  handleSuiviIce(client: Socket, data: { to_socket_id: string; candidate: any }) {
    // Note: candidate can be null (end of candidates)
    this.server.to(data.to_socket_id).emit('suivi:webrtc_ice_candidate', {
      from_socket_id: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('suivi:leave')
  handleSuiviLeave(client: Socket, data: { to_socket_id: string }) {
    // Notify the commercial that a listener left so it can close the peer connection
    this.server.to(data.to_socket_id).emit('suivi:leave', {
      from_socket_id: client.id,
    });
  }

  // Gestion de la demande d'historique des transcriptions
  @SubscribeMessage('request_transcription_history')
  handleRequestTranscriptionHistory(client: Socket, data?: { commercial_id?: string }) {
    console.log(`📚 Demande d'historique des transcriptions de ${client.id}`);
    
    let history = this.transcriptionHistory;
    
    // Filtrer par commercial si spécifié
    if (data?.commercial_id) {
      history = history.filter(session => session.commercial_id === data.commercial_id);
    }
    
    // Trier par date (plus récent en premier)
    history.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    
    console.log(`📚 Historique envoyé: ${history.length} sessions`);
    client.emit('transcription_history_response', { history });
  }

  @SubscribeMessage('transcription_update')
  handleTranscriptionUpdate(client: Socket, data: { 
    commercial_id: string; 
    transcript: string; 
    is_final: boolean; 
    timestamp: string 
  }) {
    console.log(`📝 Transcription de ${data.commercial_id}: "${data.transcript}" (final: ${data.is_final})`);
    
    // Accumuler le texte dans la session active si c'est une transcription finale
    if (data.is_final) {
      const session = this.activeTranscriptionSessions.get(data.commercial_id);
      if (session) {
        session.full_transcript += data.transcript;
        console.log(`📝 Session ${session.id} - Texte accumulé: ${session.full_transcript.length} caractères`);
      }
    }
    
    // Diffuser la transcription aux admins dans la room audio-streaming
    this.server.to('audio-streaming').emit('transcription_update', data);
  }

  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  // Méthode pour obtenir toutes les positions actuelles
  getAllLocations(): LocationUpdateData[] {
    return Array.from(this.commercialLocations.values());
  }

  // Méthode pour obtenir la position d'un commercial spécifique
  getCommercialLocation(commercialId: string): LocationUpdateData | undefined {
    return this.commercialLocations.get(commercialId);
  }
}
