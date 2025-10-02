import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { TranscriptionHistoryService } from '../transcription-history/transcription-history.service';
import { CommercialService } from '../manager-space/commercial/commercial.service';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { WsRolesGuard } from '../auth/ws-roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentralizedConfig } from './websocket.config';

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

@WebSocketGateway(CentralizedConfig.getWebSocketConfig())
@UseGuards(WsAuthGuard)
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
    
    console.log('Sauvegarde automatique périodique démarrée (toutes les 30s)');
  }

  // Sauvegarder toutes les sessions actives EN PARALLÈLE pour la scalabilité
  private async saveActiveSessions() {
    if (this.activeTranscriptionSessions.size === 0) {
      return;
    }

    const sessionCount = this.activeTranscriptionSessions.size;
    console.log(`💾 Sauvegarde automatique de ${sessionCount} session(s) active(s) en parallèle`);
    
    const startTime = Date.now();
    
    // Créer un tableau de promesses pour sauvegarder en parallèle
    const savePromises = Array.from(this.activeTranscriptionSessions.entries()).map(
      async ([commercialId, session]) => {
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
          return { success: true, commercialId };
        } catch (error) {
          console.error(`❌ Erreur sauvegarde session active ${commercialId}:`, error);
          return { success: false, commercialId, error };
        }
      }
    );

    // Attendre que toutes les sauvegardes se terminent (en parallèle)
    const results = await Promise.all(savePromises);
    
    const successCount = results.filter(r => r.success).length;
    const duration = Date.now() - startTime;
    
    console.log(`✅ Sauvegarde automatique terminée: ${successCount}/${sessionCount} réussies en ${duration}ms (${Math.round(duration / sessionCount)}ms/session en moyenne)`);
    
    if (successCount < sessionCount) {
      const failedCount = sessionCount - successCount;
      console.warn(`⚠️  ${failedCount} session(s) non sauvegardée(s)`);
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
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
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
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleLocationError(client: Socket, data: LocationErrorData) {
    console.log(`❌ Erreur GPS pour ${data.commercialId}:`, data.error);
    
    // Diffuser l'erreur aux admins
    this.server.to('gps-tracking').emit('locationError', data);
  }

  @SubscribeMessage('commercialOffline')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleCommercialOffline(client: Socket, commercialId: string) {
    console.log(`📍 Commercial ${commercialId} se déconnecte`);
    
    this.commercialLocations.delete(commercialId);
    this.commercialSockets.delete(commercialId);
    
    // Notifier les admins
    this.server.to('gps-tracking').emit('commercialOffline', commercialId);
  }

  // Gestion des événements audio streaming
  @SubscribeMessage('start_streaming')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleStartStreaming(client: Socket, data: { commercial_id: string; commercial_info?: any; building_id?: string; building_name?: string }) {
    console.log(`🎤 Commercial ${data.commercial_id} démarre le streaming`);
    
    // Stocker l'état du stream actif
    this.activeStreams.set(data.commercial_id, {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info || {},
      socket_id: client.id,
    });
    
    // Créer une nouvelle session de transcription SEULEMENT si elle n'existe pas
    let session = this.activeTranscriptionSessions.get(data.commercial_id);
    if (!session) {
      const sessionId = `${data.commercial_id}_${Date.now()}`;
      session = {
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
    } else {
      // Session existe déjà, ne pas en créer une nouvelle
      console.log(`♻️  Session de transcription existe déjà pour ${data.commercial_id} (ID: ${session.id}), réutilisation`);
      // Mettre à jour les infos du bâtiment si nécessaire
      if (data.building_name && !session.building_name) {
        session.building_name = data.building_name;
        session.building_id = data.building_id;
      }
    }
    
    // Diffuser aux admins dans la room audio-streaming avec socket_id
    this.server.to('audio-streaming').emit('start_streaming', {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info || {},
      socket_id: client.id,
    });
  }

  @SubscribeMessage('stop_streaming')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
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

      this.sessionDoorTexts.delete(session.id);
      
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
    
    // Diffuser aux admins dans la room audio-streaming
    this.server.to('audio-streaming').emit('stop_streaming', data);
  }

  @SubscribeMessage('emergency_save_session')
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager', 'commercial')
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
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager')
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
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager')
  async handleRequestManagerStreamingStatus(client: Socket, data: { managerId: string }) {
    console.log(`🔄 Demande de synchronisation des streams pour manager ${data.managerId} de ${client.id}`);
    
    try {
      // Récupérer les commerciaux du manager
      const commerciaux = await this.commercialService.getManagerCommerciaux(data.managerId);
      const commercialIds = commerciaux.map((c: any) => c.id);
      
      console.log(`👥 Manager ${data.managerId} a ${commerciaux.length} commerciaux:`, commercialIds);
      
      // Filtrer les streams actifs selon les commerciaux du manager
      const allActiveStreams = Array.from(this.activeStreams.values());
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

  // --- WebRTC signaling moved to AudioGateway to prevent duplicate handlers ---

  // Gestion de la demande d'historique des transcriptions
  @SubscribeMessage('request_transcription_history')
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager')
  async handleRequestTranscriptionHistory(client: Socket, data?: { commercial_id?: string }) {
    console.log(`📚 Demande d'historique des transcriptions de ${client.id}`);
    
    try {
      // Récupérer l'historique depuis la base de données
      const history = await this.transcriptionHistoryService.getHistory(data?.commercial_id);
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

  /**
   * 🔗 Lier une porte à la session de transcription active d'un commercial
   */
  linkDoorToActiveSession(commercialId: string, doorLabel: string) {
    const session = this.activeTranscriptionSessions.get(commercialId);
    if (session) {
      if (!session.visited_doors) {
        session.visited_doors = [];
      }
      // N'ajouter que si cette porte n'est pas déjà dans la liste
      if (!session.visited_doors.includes(doorLabel)) {
        session.visited_doors.push(doorLabel);
        console.log(`🔗 Porte ${doorLabel} ajoutée à la session ${session.id} du commercial ${commercialId}`);
      }
    } else {
      console.log(`⚠️ Aucune session active trouvée pour le commercial ${commercialId} - porte ${doorLabel} non liée`);
    }
  }

  @SubscribeMessage('transcription_update')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
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

  // ---- Browser-based transcription coordination ----

  @SubscribeMessage('transcription_start')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  async handleTranscriptionStart(client: Socket, data: {
    commercial_id: string;
    building_id?: string;
    building_name?: string;
    source?: string;
  }) {
    let session = this.activeTranscriptionSessions.get(data.commercial_id);
    if (!session) {
      const sessionId = `${data.commercial_id}_${Date.now()}`;
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
      console.log(`📝 Session de transcription initialisée pour ${data.commercial_id} (${commercialName}) via ${data.source || 'navigateur'}`);
    } else {
      // Session existe déjà, ne pas en créer une nouvelle
      // Seulement mettre à jour les informations manquantes
      if (data.building_name && !session.building_name) {
        session.building_name = data.building_name;
        session.building_id = data.building_id;
      }
      console.log(`♻️  Session de transcription existe déjà pour ${data.commercial_id} (ID: ${session.id}), réutilisation (source: ${data.source || 'navigateur'})`);
    }
  }

  @SubscribeMessage('transcription_stop')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleTranscriptionStop(client: Socket, data: { commercial_id: string }) {
    console.log(`🛑 Transcription arrêtée côté navigateur pour ${data.commercial_id}`);
    const session = this.activeTranscriptionSessions.get(data.commercial_id);
    if (session) {
      this.sessionDoorTexts.delete(session.id);
    }
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
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager')
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
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager')
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
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
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
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
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
  @UseGuards(WsRolesGuard)
  @Roles('commercial', 'manager')
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
  @UseGuards(WsRolesGuard)
  @Roles('admin')
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

  // Gestion de l'ajout d'étages
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
}
