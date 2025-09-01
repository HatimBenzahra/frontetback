import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as https from 'https';
import { IncomingMessage, RequestOptions } from 'http';
import { TranscriptionHistoryService } from '../transcription-history/transcription-history.service';
import { CommercialService } from '../manager-space/commercial/commercial.service';

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
  visited_doors?: string[];
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const allowed = [
        `https://${process.env.LOCAL_IP}:${process.env.FRONTEND_PORT}`,
        `http://${process.env.LOCAL_IP}:${process.env.FRONTEND_PORT}`,
        `https://${process.env.PRODUCTION_IP}`,
        `http://${process.env.PRODUCTION_IP}`,
        `https://${process.env.STAGING_IP}`,
        `http://${process.env.STAGING_IP}`,
      ];
      // Autoriser n'importe quelle IP locale 192.168.x.x avec ou sans port, en http ou https
      const isLocalNetwork = /^https?:\/\/192\.168\.[0-9]+\.[0-9]+(:\d+)?$/.test(origin);
      if (allowed.includes(origin) || isLocalNetwork) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private transcriptionHistoryService: TranscriptionHistoryService,
    private commercialService: CommercialService
  ) {
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
    
    // Nettoyer le manager connecté s'il se déconnecte
    const disconnectedManager = Array.from(this.connectedManagers.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    if (disconnectedManager) {
      this.connectedManagers.delete(disconnectedManager);
      console.log(`🗑️ Manager ${disconnectedManager} retiré de la liste des connectés`);
    }
    
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
    
    console.log('Sauvegarde automatique périodique démarrée (toutes les 30s)');
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
        // Sauvegarder SANS traitement IA (sauvegarde automatique)
        await this.transcriptionHistoryService.saveSession(sessionBackup, true);
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
      // Sauvegarder SANS traitement IA (sauvegarde temporaire)
      await this.transcriptionHistoryService.saveSession(sessionBackup, true);
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
  async handleStartStreaming(client: Socket, data: { commercial_id: string; commercial_info?: any; building_id?: string; building_name?: string }) {
    console.log(`🎤 Commercial ${data.commercial_id} démarre le streaming`);
    
    // Stocker l'état du stream actif
    this.activeStreams.set(data.commercial_id, {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info || {},
      socket_id: client.id,
    });
    
    // Mettre à jour le cache d'historique - déterminer le manager actuel du commercial
    try {
      const managerId = await this.commercialService.getCommercialManagerId(data.commercial_id);
      if (managerId) {
        this.managerStreamHistory.set(data.commercial_id, managerId);
        console.log(`📊 Commercial ${data.commercial_id} assigné au manager ${managerId} dans le cache`);
      } else {
        console.log(`⚠️ Commercial ${data.commercial_id} n'a pas de manager assigné`);
      }
    } catch (error) {
      console.log(`❌ Erreur lors de la détermination du manager pour commercial ${data.commercial_id}:`, error);
    }
    
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
    
    // Diffuser intelligemment les événements de stream
    const streamPayload = {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info || {},
      socket_id: client.id,
    };

    // Récupérer le manager responsable de ce commercial
    const managerId = await this.commercialService.getCommercialManagerId(data.commercial_id);
    
    // Parcourir tous les clients connectés dans la room pour filtrer
    const room = this.server.sockets.adapter.rooms.get('audio-streaming');
    if (room) {
      for (const socketId of room) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          // Déterminer si ce socket doit recevoir cet événement
          let shouldSend = false;
          
          // Vérifier si c'est un manager et si c'est le bon manager
          const isManagerSocket = Array.from(this.connectedManagers.entries())
            .find(([mId, sId]) => sId === socketId);
          
          if (isManagerSocket) {
            const [managerIdForSocket] = isManagerSocket;
            shouldSend = managerIdForSocket === managerId;
            console.log(`Manager ${managerIdForSocket}: ${shouldSend ? 'AUTORISÉ' : 'REFUSÉ'} pour commercial ${data.commercial_id}`);
          } else {
            // Si ce n'est pas un manager identifié, c'est probablement un admin → autoriser
            shouldSend = true;
            console.log(`Socket non-manager ${socketId}: AUTORISÉ (admin/directeur)`);
          }
          
          if (shouldSend) {
            socket.emit('start_streaming', streamPayload);
          }
        }
      }
    }
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
      
      // Sauvegarder en base de données de façon persistante AVEC traitement IA (sauvegarde finale)
      try {
        await this.transcriptionHistoryService.saveSession(session); // skipAI = false par défaut
        console.log(`💾 Session ${session.id} sauvegardée en base de données avec traitement IA`);
      } catch (error) {
        console.error(`❌ Erreur sauvegarde session ${session.id}:`, error);
      }
      
      // Supprimer de la session active
      this.activeTranscriptionSessions.delete(data.commercial_id);
      
      // Notifier les admins de la nouvelle session dans l'historique
      this.server.to('audio-streaming').emit('transcription_session_completed', session);
    }
    
    // Diffuser intelligemment l'arrêt du stream (même logique que start_streaming)
    const managerId = this.managerStreamHistory.get(data.commercial_id);
    
    const room = this.server.sockets.adapter.rooms.get('audio-streaming');
    if (room) {
      for (const socketId of room) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          let shouldSend = false;
          
          const isManagerSocket = Array.from(this.connectedManagers.entries())
            .find(([mId, sId]) => sId === socketId);
          
          if (isManagerSocket) {
            const [managerIdForSocket] = isManagerSocket;
            shouldSend = managerIdForSocket === managerId;
            console.log(`Manager ${managerIdForSocket}: ${shouldSend ? 'AUTORISÉ' : 'REFUSÉ'} pour stop_streaming ${data.commercial_id}`);
          } else {
            // Admins/directeurs voient tout
            shouldSend = true;
          }
          
          if (shouldSend) {
            socket.emit('stop_streaming', data);
          }
        }
      }
    }
    
    // Nettoyer le cache d'historique
    this.managerStreamHistory.delete(data.commercial_id);
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

  // Gestion de la demande de synchronisation des streams filtrés par manager
  @SubscribeMessage('request_manager_streaming_status')
  async handleRequestManagerStreamingStatus(client: Socket, data: { managerId: string }) {
    console.log(`🔄 Demande de synchronisation des streams pour manager ${data.managerId} de ${client.id}`);
    
    // Enregistrer ce manager comme connecté
    this.connectedManagers.set(data.managerId, client.id);
    console.log(`📝 Manager ${data.managerId} enregistré avec socket ${client.id}`);
    
    try {
      // Récupérer les commerciaux du manager (TOUJOURS depuis la DB pour avoir les données à jour)
      const commerciaux = await this.commercialService.getManagerCommerciaux(data.managerId);
      const commercialIds = commerciaux.map((c: any) => c.id);
      
      console.log(`👥 Manager ${data.managerId} a ${commerciaux.length} commerciaux:`, commercialIds);
      
      // Mettre à jour le cache d'historique pour les commerciaux actuels
      commercialIds.forEach(commercialId => {
        this.managerStreamHistory.set(commercialId, data.managerId);
      });
      
      // Identifier TOUS les streams qui ne doivent pas être visibles par ce manager
      const allActiveStreams = Array.from(this.activeStreams.values());
      const streamsToRemove: string[] = [];
      
      for (const stream of allActiveStreams) {
        // Si ce stream N'EST PAS dans la liste des commerciaux de ce manager
        if (!commercialIds.includes(stream.commercial_id)) {
          // Vérifier si ce manager pourrait légitimement voir ce stream
          try {
            await this.commercialService.getManagerCommercial(data.managerId, stream.commercial_id);
            // Si pas d'exception, le commercial est bien sous ce manager → erreur de logique
            console.log(`⚠️ INCOHÉRENCE: Commercial ${stream.commercial_id} devrait être dans la liste mais n'y est pas`);
          } catch (error) {
            // Si ForbiddenException → le commercial n'appartient pas à ce manager → OK
            streamsToRemove.push(stream.commercial_id);
            console.log(`🧹 Stream ${stream.commercial_id} ne doit pas être visible par manager ${data.managerId}`);
          }
        }
      }
      
      if (streamsToRemove.length > 0) {
        console.log(`🧹 Nettoyage ${streamsToRemove.length} streams obsolètes pour manager ${data.managerId}:`, streamsToRemove);
        
        // Nettoyer le cache d'historique pour ces commerciaux
        streamsToRemove.forEach(commercialId => {
          this.managerStreamHistory.delete(commercialId);
        });
        
        // Notifier spécifiquement ce manager que ces streams ne lui appartiennent plus
        client.emit('manager_streams_removed', {
          removed_commercial_ids: streamsToRemove,
          manager_id: data.managerId
        });
      }
      
      // Filtrer les streams actifs selon les commerciaux actuels du manager
      const filteredStreams = allActiveStreams.filter(stream => commercialIds.includes(stream.commercial_id));
      
      console.log(`🎤 Streams actifs total: ${allActiveStreams.length}`);
      console.log(`🎤 Streams filtrés pour manager ${data.managerId}: ${filteredStreams.length}`);
      
      if (filteredStreams.length > 0) {
        console.log(`✅ Streams filtrés:`, filteredStreams.map(s => s.commercial_id));
      }
      
      // Envoyer l'état filtré des streams au client qui demande
      client.emit('streaming_status_response', {
        active_streams: filteredStreams
      });
    } catch (error) {
      console.error(`❌ Erreur filtrage streams manager ${data.managerId}:`, error);
      // En cas d'erreur, renvoyer une liste vide
      client.emit('streaming_status_response', {
        active_streams: []
      });
    }
  }

  // Cache pour tracker l'historique des affectations manager ↔ commercial
  private managerStreamHistory = new Map<string, string>(); // commercialId -> managerId
  
  // Tracker les managers connectés avec leur socket
  private connectedManagers = new Map<string, string>(); // managerId -> socketId

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

  // Fonction utilitaire pour nettoyer et dédupliquer les transcriptions
  private cleanAndDeduplicateTranscript(currentText: string, newText: string): string {
    const cleanNewText = newText.trim();
    if (!cleanNewText) return currentText;
    
    // Si le texte actuel se termine déjà par le nouveau texte, ne pas l'ajouter
    if (currentText.endsWith(cleanNewText)) {
      return currentText;
    }
    
    // Si le nouveau texte contient le texte actuel, le remplacer
    if (cleanNewText.includes(currentText) && currentText.length > 0) {
      return cleanNewText;
    }
    
    // Sinon, ajouter avec un séparateur approprié
    const separator = currentText && !currentText.endsWith(' ') ? ' ' : '';
    return currentText + separator + cleanNewText;
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
        // Utiliser la fonction de nettoyage pour éviter les doublons
        session.full_transcript = this.cleanAndDeduplicateTranscript(session.full_transcript, data.transcript);

        // Ajouter la porte à la liste des portes visitées si fourni
        if (data.door_label) {
          if (!session.visited_doors) {
            session.visited_doors = [];
          }
          // N'ajouter que si cette porte n'est pas déjà dans la liste
          if (!session.visited_doors.includes(data.door_label)) {
            session.visited_doors.push(data.door_label);
          }
        }

        // Accumuler par porte si fournie
        if (data.door_id) {
          let doorMap = this.sessionDoorTexts.get(session.id);
          if (!doorMap) {
            doorMap = new Map<string, string>();
            this.sessionDoorTexts.set(session.id, doorMap);
          }
          const prev = doorMap.get(data.door_id) ?? '';
          // Utiliser la même fonction de nettoyage pour les transcriptions par porte
          doorMap.set(data.door_id, this.cleanAndDeduplicateTranscript(prev, data.transcript));
        }
        console.log(`📝 Session ${session.id} - Texte accumulé: ${session.full_transcript.length} caractères`);

        // Sauvegarde immédiate désactivée - la sauvegarde automatique toutes les 30s suffit
        // pour éviter les appels IA répétés après chaque phrase
        // this.saveActiveSessionImmediate(data.commercial_id, session);
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

  // Gestion des mises à jour de portes pour la synchronisation en temps réel
  @SubscribeMessage('porte:update')
  handlePorteUpdate(client: Socket, data: { porteId: string; updates: any }) {
    console.log(`🚪 Mise à jour de porte: ${data.porteId}`, data.updates);
    
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

  // Gestion des changements de statut de portes
  @SubscribeMessage('porte:statusChanged')
  handlePorteStatusChange(client: Socket, data: { porteId: string; statut: string; assigneeId?: string }) {
    console.log(`🚪 Changement de statut de porte: ${data.porteId} -> ${data.statut}`);
    
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

  // Gestion des assignations de portes (mode duo)
  @SubscribeMessage('porte:assign')
  handlePorteAssign(client: Socket, data: { porteId: string; assigneeId: string }) {
    console.log(`🚪 Assignation de porte: ${data.porteId} -> ${data.assigneeId}`);
    
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

  // Gestion de l'ajout de portes
  @SubscribeMessage('porte:added')
  handlePorteAdded(client: Socket, data: { porte: any }) {
    console.log(`🚪 Ajout de porte: ${data.porte.id}`);
    
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

  // Gestion de la suppression de portes
  @SubscribeMessage('porte:deleted')
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

  // Gestion de l'ajout d'étages
  @SubscribeMessage('floor:added')
  handleFloorAdded(client: Socket, data: { newNbEtages: number }) {
    console.log(`🏢 Ajout d'étage: ${data.newNbEtages} étages total`);
    
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
}
