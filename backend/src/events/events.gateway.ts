import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as https from 'https';
import { IncomingMessage, RequestOptions } from 'http';
import { TranscriptionHistoryService } from '../transcription-history/transcription-history.service';

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
  building_id?: string;
  building_name?: string;
  last_door_label?: string;
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

  constructor(private transcriptionHistoryService: TranscriptionHistoryService) {
    // Sauvegarde automatique périodique des sessions actives
    this.startPeriodicBackup();
  }

  // Stocker les positions des commerciaux en mémoire
  private commercialLocations = new Map<string, LocationUpdateData>();
  private commercialSockets = new Map<string, string>(); // commercialId -> socketId
  private commercialLastSeen = new Map<string, number>(); // commercialId -> timestamp
  private offlineTimers = new Map<string, NodeJS.Timeout>(); // commercialId -> timeout
  private activeStreams = new Map<string, { commercial_id: string; commercial_info: any; socket_id: string }>(); // commercialId -> stream info + socket id
  
  // Gestion des sessions de transcription
  private activeTranscriptionSessions = new Map<string, TranscriptionSession>(); // commercialId -> session en cours
  private transcriptionHistory: TranscriptionSession[] = []; // Historique des sessions

  // Deepgram streaming (server-side) state per commercial
  private dgStreams = new Map<string, {
    req: import('http').ClientRequest;
    res: IncomingMessage | null;
    startedAt: number;
    lastDoorId?: string;
    lastDoorLabel?: string;
  }>();

  // Minimal per-session per-door aggregation (in-memory)
  private sessionDoorTexts = new Map<string, Map<string, string>>(); // sessionId -> (doorId -> text)
  
  // Timer pour la sauvegarde automatique
  private backupTimer: NodeJS.Timeout | null = null;

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
      
      // Nettoyer aussi l'état de streaming si le commercial était en train de streamer
      if (this.activeStreams.has(commercialId)) {
        console.log(`🎤 Commercial ${commercialId} se déconnecte pendant le streaming`);
        
        // Sauvegarder la session active avant de la supprimer
        const activeSession = this.activeTranscriptionSessions.get(commercialId);
        if (activeSession) {
          console.log(`💾 Sauvegarde d'urgence de la session ${commercialId} avant déconnexion`);
          this.saveActiveSessionImmediate(commercialId, activeSession);
        }
        
        this.activeStreams.delete(commercialId);
        this.server.to('audio-streaming').emit('stop_streaming', { commercial_id: commercialId });
      }
      
      // Ne pas supprimer immédiatement les données GPS, attendre un délai
      // pour permettre la reconnexion
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

  // Démarrer la sauvegarde automatique périodique
  private startPeriodicBackup() {
    // Sauvegarder toutes les 30 secondes
    this.backupTimer = setInterval(() => {
      this.saveActiveSessions();
    }, 30000); // 30 secondes
    
    console.log('🔄 Sauvegarde automatique périodique démarrée (toutes les 30s)');
  }

  // Sauvegarder toutes les sessions actives
  private async saveActiveSessions() {
    if (this.activeTranscriptionSessions.size === 0) {
      return;
    }

    console.log(`💾 Sauvegarde automatique de ${this.activeTranscriptionSessions.size} session(s) active(s)`);
    
    for (const [commercialId, session] of this.activeTranscriptionSessions) {
      try {
        // Créer une copie de la session avec un end_time temporaire pour la sauvegarde
        const sessionBackup = {
          ...session,
          end_time: new Date().toISOString(), // Temporaire pour la sauvegarde
          duration_seconds: Math.round((new Date().getTime() - new Date(session.start_time).getTime()) / 1000)
        };

        // Utiliser l'ID original de la session (upsert mettra à jour si elle existe)
        await this.transcriptionHistoryService.saveSession(sessionBackup);
        console.log(`💾 Session active ${commercialId} sauvegardée (backup)`);
      } catch (error) {
        console.error(`❌ Erreur sauvegarde session active ${commercialId}:`, error);
      }
    }
  }

  // Sauvegarde immédiate d'une session spécifique
  private async saveActiveSessionImmediate(commercialId: string, session: any) {
    try {
      // Créer une copie de la session avec un end_time temporaire
      const sessionBackup = {
        ...session,
        end_time: new Date().toISOString(), // Temporaire pour la sauvegarde
        duration_seconds: Math.round((new Date().getTime() - new Date(session.start_time).getTime()) / 1000)
      };

      // Utiliser l'ID original de la session (upsert mettra à jour si elle existe)
      await this.transcriptionHistoryService.saveSession(sessionBackup);
      console.log(`💾 Session active ${commercialId} sauvegardée immédiatement (${sessionBackup.full_transcript.length} chars)`);
    } catch (error) {
      console.error(`❌ Erreur sauvegarde immédiate ${commercialId}:`, error);
    }
  }

  // Nettoyer les ressources
  onModuleDestroy() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    
    // Nettoyer tous les timers de déconnexion
    this.offlineTimers.forEach(timer => clearTimeout(timer));
    this.offlineTimers.clear();
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, room: string) {
    client.join(room);
    console.log(`📡 Client ${client.id} joined room: ${room}`);
    
    // Si c'est la room de tracking GPS, envoyer les positions actuelles
    if (room === 'gps-tracking') {
      console.log(`📍 Envoi des positions actuelles à ${client.id} (${this.commercialLocations.size} commerciaux)`);
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

  // Gestion des événements audio streaming
  @SubscribeMessage('start_streaming')
  handleStartStreaming(client: Socket, data: { commercial_id: string; commercial_info?: any; building_id?: string; building_name?: string }) {
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
      duration_seconds: 0,
      building_id: data.building_id,
      building_name: data.building_name
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
  async handleStopStreaming(client: Socket, data: { commercial_id: string }) {
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
      
      // Ajouter à l'historique en mémoire
      this.transcriptionHistory.push(session);
      console.log(`📝 Session de transcription terminée pour ${data.commercial_id}:`, {
        duration: session.duration_seconds,
        transcript_length: session.full_transcript.length
      });
      
      // Sauvegarder en base de données de façon persistante
      try {
        await this.transcriptionHistoryService.saveSession(session);
        console.log(`💾 Session ${session.id} sauvegardée en base de données`);
      } catch (error) {
        console.error(`❌ Erreur sauvegarde session ${session.id}:`, error);
      }
      
      // Supprimer de la session active
      this.activeTranscriptionSessions.delete(data.commercial_id);
      
      // Notifier les admins de la nouvelle session dans l'historique
      this.server.to('audio-streaming').emit('transcription_session_completed', session);
    }
    
    // Diffuser aux admins dans la room audio-streaming
    this.server.to('audio-streaming').emit('stop_streaming', data);
  }

  @SubscribeMessage('emergency_save_session')
  async handleEmergencySave(client: Socket, data: { commercial_id: string }) {
    console.log(`🚨 Sauvegarde d'urgence demandée pour ${data.commercial_id}`);
    
    const session = this.activeTranscriptionSessions.get(data.commercial_id);
    if (session) {
      await this.saveActiveSessionImmediate(data.commercial_id, session);
      console.log(`💾 Sauvegarde d'urgence effectuée pour ${data.commercial_id}`);
    } else {
      console.log(`⚠️  Aucune session active trouvée pour ${data.commercial_id}`);
    }
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
  async handleRequestTranscriptionHistory(client: Socket, data?: { commercial_id?: string }) {
    console.log(`📚 Demande d'historique des transcriptions de ${client.id}`);
    
    try {
      // Récupérer l'historique depuis la base de données
      const history = await this.transcriptionHistoryService.getHistory(data?.commercial_id, 100);
      console.log(`📚 Historique récupéré de la DB: ${history.length} sessions`);
      client.emit('transcription_history_response', { history });
    } catch (error) {
      console.error('❌ Erreur récupération historique DB:', error);
      // Fallback sur l'historique en mémoire
      let history = this.transcriptionHistory;
      if (data?.commercial_id) {
        history = history.filter(session => session.commercial_id === data.commercial_id);
      }
      console.log(`📚 Fallback historique mémoire: ${history.length} sessions`);
      client.emit('transcription_history_response', { history });
    }
  }

  @SubscribeMessage('transcription_update')
  handleTranscriptionUpdate(client: Socket, data: {
    commercial_id: string;
    transcript: string;
    is_final: boolean;
    timestamp: string;
    door_id?: string;
    door_label?: string;
  }) {
    const doorInfo = data.door_label ? data.door_label : (data.door_id ?? 'n/a');
    console.log(`📝 Transcription de ${data.commercial_id}: "${data.transcript}" (final: ${data.is_final}) porte=${doorInfo}`);

    // Accumuler le texte dans la session active si c'est une transcription finale
    if (data.is_final) {
      const session = this.activeTranscriptionSessions.get(data.commercial_id);
      if (session) {
        session.full_transcript += data.transcript;

        // Mettre à jour le label de la dernière porte si fourni
        if (data.door_label) {
          session.last_door_label = data.door_label;
        }

        // Accumuler par porte si fournie
        if (data.door_id) {
          let doorMap = this.sessionDoorTexts.get(session.id);
          if (!doorMap) {
            doorMap = new Map<string, string>();
            this.sessionDoorTexts.set(session.id, doorMap);
          }
          const prev = doorMap.get(data.door_id) ?? '';
          doorMap.set(data.door_id, prev + data.transcript);
        }
        console.log(`📝 Session ${session.id} - Texte accumulé: ${session.full_transcript.length} caractères`);

        // Sauvegarde immédiate de la session mise à jour (sauvegarde incrémentale)
        this.saveActiveSessionImmediate(data.commercial_id, session);
      }
    }

    // Diffuser la transcription aux admins dans la room audio-streaming
    this.server.to('audio-streaming').emit('transcription_update', data);
  }

  // ---- Server-side Deepgram streaming (receive audio chunks from client) ----

  @SubscribeMessage('transcription_start')
  async handleTranscriptionStart(client: Socket, data: {
    commercial_id: string;
    building_id?: string;
    building_name?: string;
    mime_type?: string; // e.g. 'audio/webm;codecs=opus'
  }) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('❌ DEEPGRAM_API_KEY is not set in backend env');
      client.emit('transcription_error', { message: 'Deepgram API key is missing on server' });
      return;
    }

    // Créer ou récupérer la session de transcription active
    let session = this.activeTranscriptionSessions.get(data.commercial_id);
    if (!session) {
      const sessionId = `${data.commercial_id}_${Date.now()}`;
      
      // Récupérer le vrai nom du commercial depuis la base de données
      const commercialName = await this.transcriptionHistoryService.getCommercialName(data.commercial_id);
      
      session = {
        id: sessionId,
        commercial_id: data.commercial_id,
        commercial_name: commercialName,
        start_time: new Date().toISOString(),
        end_time: '',
        full_transcript: '',
        duration_seconds: 0,
        building_id: data.building_id,
        building_name: data.building_name,
      };
      this.activeTranscriptionSessions.set(data.commercial_id, session);
      console.log(`📝 Session de transcription créée via transcription_start pour ${data.commercial_id} (${commercialName}):`, sessionId);
    } else if (data.building_name && !session.building_name) {
      // Mettre à jour le nom de l'immeuble si il n'était pas défini
      session.building_name = data.building_name;
      session.building_id = data.building_id;
    }

    const mime = data.mime_type || 'audio/webm;codecs=opus';
    try {
      // Close existing stream if any
      const existing = this.dgStreams.get(data.commercial_id);
      if (existing) {
        try { existing.req.end(); } catch {}
      }
      const params = new URLSearchParams({
        language: 'fr',
        punctuate: 'true',
        interim_results: 'true',
        diarize: 'false',
      }).toString();
      const options: RequestOptions = {
        method: 'POST',
        host: 'api.deepgram.com',
        path: `/v1/listen?${params}`,
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': mime,
          'Transfer-Encoding': 'chunked',
        },
      };
      const req = https.request(options, (res: IncomingMessage) => {
        res.setEncoding('utf8');
        let buffer = '';
        res.on('data', (chunk: string) => {
          buffer += chunk;
          // Deepgram sends newline-delimited JSON; split safely
          let idx: number;
          while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line) continue;
            try {
              const msg = JSON.parse(line);
              const alt = msg?.channel?.alternatives?.[0];
              const transcript: string = alt?.transcript ?? '';
              const is_final: boolean = !!msg?.is_final;
              if (transcript) {
                const now = new Date().toISOString();
                // Use last known door id and label for this stream (may be updated by chunk messages)
                const state = this.dgStreams.get(data.commercial_id);
                const door_id = state?.lastDoorId;
                const door_label = state?.lastDoorLabel;
                this.handleTranscriptionUpdate(client, {
                  commercial_id: data.commercial_id,
                  transcript: transcript + (is_final ? '\n' : ''),
                  is_final,
                  timestamp: now,
                  door_id,
                  door_label,
                });
              }
            } catch (e) {
              // Non-JSON lines or partial fragments, ignore
            }
          }
        });
        res.on('error', (err) => {
          console.error('❌ Deepgram response error:', err);
          client.emit('transcription_error', { message: 'Deepgram response error' });
        });
      });
      req.on('error', (err) => {
        console.error('❌ Deepgram request error:', err);
        client.emit('transcription_error', { message: 'Deepgram connection error' });
      });
      this.dgStreams.set(data.commercial_id, { req, res: null, startedAt: Date.now() });
      console.log(`🎧 Deepgram streaming started for ${data.commercial_id}`);
    } catch (e) {
      console.error('❌ Failed to start Deepgram streaming:', e);
      client.emit('transcription_error', { message: 'Failed to start Deepgram streaming' });
    }
  }

  @SubscribeMessage('transcription_audio_chunk')
  handleTranscriptionAudioChunk(client: Socket, data: {
    commercial_id: string;
    door_id?: string;
    door_label?: string;
    chunk: ArrayBuffer | Buffer | Uint8Array;
  }) {
    const state = this.dgStreams.get(data.commercial_id);
    if (!state) return;
    if (data.door_id) state.lastDoorId = data.door_id;
    if (data.door_label) state.lastDoorLabel = data.door_label;
    try {
      const buf = Buffer.isBuffer(data.chunk) ? data.chunk : Buffer.from(data.chunk as ArrayBuffer);
      state.req.write(buf);
    } catch (e) {
      console.error('❌ Error forwarding audio chunk to Deepgram:', e);
    }
  }

  @SubscribeMessage('transcription_stop')
  handleTranscriptionStop(client: Socket, data: { commercial_id: string }) {
    const state = this.dgStreams.get(data.commercial_id);
    if (!state) return;
    try {
      state.req.end();
    } catch {}
    this.dgStreams.delete(data.commercial_id);
    console.log(`🛑 Deepgram streaming stopped for ${data.commercial_id}`);
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

  // Méthode pour vérifier si un commercial est en ligne
  isCommercialOnline(commercialId: string): boolean {
    return this.commercialSockets.has(commercialId);
  }

  // Méthode pour obtenir le timestamp de dernière activité
  getCommercialLastSeen(commercialId: string): number | undefined {
    return this.commercialLastSeen.get(commercialId);
  }

  // Demande de l'état actuel des commerciaux GPS
  @SubscribeMessage('request_gps_state')
  handleRequestGPSState(client: Socket) {
    console.log(`📍 Demande d'état GPS de ${client.id}`);
    
    // Envoyer toutes les positions actuelles
    this.commercialLocations.forEach((location, commercialId) => {
      client.emit('locationUpdate', location);
    });
    
    console.log(`📍 État GPS envoyé: ${this.commercialLocations.size} commerciaux`);
  }

  // Demande de l'état des commerciaux avec leurs statuts
  @SubscribeMessage('request_commercials_status')
  handleRequestCommercialsStatus(client: Socket) {
    console.log(`👥 Demande de statut des commerciaux de ${client.id}`);
    
    const commercialStatus = new Map<string, {
      isOnline: boolean;
      isTranscribing: boolean;
      lastSeen?: number;
      currentSession?: string;
    }>();

    // Parcourir tous les commerciaux connectés
    this.commercialSockets.forEach((socketId, commercialId) => {
      commercialStatus.set(commercialId, {
        isOnline: true,
        isTranscribing: this.activeTranscriptionSessions.has(commercialId),
        lastSeen: this.commercialLastSeen.get(commercialId),
        currentSession: this.activeTranscriptionSessions.get(commercialId)?.id
      });
    });

    // Ajouter les commerciaux en transcription mais pas forcément en ligne
    this.activeTranscriptionSessions.forEach((session, commercialId) => {
      if (!commercialStatus.has(commercialId)) {
        commercialStatus.set(commercialId, {
          isOnline: false,
          isTranscribing: true,
          currentSession: session.id
        });
      }
    });

    client.emit('commercials_status_response', {
      status: Array.from(commercialStatus.entries()).map(([id, status]) => ({
        commercial_id: id,
        ...status
      }))
    });
  }

  // Gestion du ping pour mesurer la latence
  @SubscribeMessage('ping')
  handlePing(client: Socket, startTime: number) {
    // Renvoyer immédiatement le timestamp pour calculer la latence
    client.emit('pong', startTime);
  }
}
