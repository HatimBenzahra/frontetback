import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TranscriptionHistoryService } from '../../transcription-history/transcription-history.service';
import { CommercialService } from '../../manager-space/commercial/commercial.service';
import { websocketConfig } from '../websocket.config';

interface ActiveStream {
  commercial_id: string;
  commercial_info?: any;
  socket_id: string;
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

@WebSocketGateway(websocketConfig)
export class AudioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private transcriptionHistoryService: TranscriptionHistoryService,
    private commercialService: CommercialService
  ) {
    this.startPeriodicBackup();
  }

  // État des streams actifs et sessions de transcription
  private activeStreams = new Map<string, ActiveStream>();
  private activeTranscriptionSessions = new Map<string, TranscriptionSession>();
  private transcriptionHistory: TranscriptionSession[] = [];
  
  // Cache pour tracker l'historique des affectations manager ↔ commercial
  private managerStreamHistory = new Map<string, string>();
  
  // Tracker les managers connectés avec leur socket
  private connectedManagers = new Map<string, string>();

  // Timer pour la sauvegarde automatique
  private backupTimer: NodeJS.Timeout | null = null;

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`🎵 Audio client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🎵 Audio client disconnected: ${client.id}`);
    
    // Nettoyer le manager connecté s'il se déconnecte
    const disconnectedManager = Array.from(this.connectedManagers.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    if (disconnectedManager) {
      this.connectedManagers.delete(disconnectedManager);
      console.log(`🗑️ Manager ${disconnectedManager} retiré de la liste audio`);
    }
  }

  // Démarrer la sauvegarde automatique périodique
  private startPeriodicBackup() {
    this.backupTimer = setInterval(() => {
      this.saveActiveSessions();
    }, 30000);
    console.log('🎵 Sauvegarde automatique audio démarrée (30s)');
  }

  // Sauvegarder toutes les sessions actives
  private async saveActiveSessions() {
    if (this.activeTranscriptionSessions.size === 0) return;

    console.log(`💾 Sauvegarde automatique de ${this.activeTranscriptionSessions.size} session(s) audio`);
    
    for (const [commercialId, session] of this.activeTranscriptionSessions) {
      try {
        const sessionBackup = {
          ...session,
          end_time: new Date().toISOString(),
          duration_seconds: Math.round((new Date().getTime() - new Date(session.start_time).getTime()) / 1000)
        };

        await this.transcriptionHistoryService.saveSession(sessionBackup, true);
        console.log(`💾 Session audio ${commercialId} sauvegardée`);
      } catch (error) {
        console.error(`❌ Erreur sauvegarde session audio ${commercialId}:`, error);
      }
    }
  }

  // Nettoyer les ressources
  onModuleDestroy() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
  }

  @SubscribeMessage('start_streaming')
  async handleStartStreaming(client: Socket, data: { commercial_id: string; commercial_info?: any; building_id?: string; building_name?: string }) {
    console.log(`🎤 Commercial ${data.commercial_id} démarre le streaming`);
    
    // Stocker l'état du stream actif
    this.activeStreams.set(data.commercial_id, {
      commercial_id: data.commercial_id,
      commercial_info: data.commercial_info || {},
      socket_id: client.id,
    });
    
    // Mettre à jour le cache d'historique
    try {
      const managerId = await this.commercialService.getCommercialManagerId(data.commercial_id);
      if (managerId) {
        this.managerStreamHistory.set(data.commercial_id, managerId);
        console.log(`📊 Commercial ${data.commercial_id} assigné au manager ${managerId} dans le cache`);
      }
    } catch (error) {
      console.log(`❌ Erreur assignation manager pour commercial ${data.commercial_id}:`, error);
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
      
      // Sauvegarder en base de données avec traitement IA
      try {
        await this.transcriptionHistoryService.saveSession(session);
        console.log(`💾 Session ${session.id} sauvegardée en base avec IA`);
      } catch (error) {
        console.error(`❌ Erreur sauvegarde session ${session.id}:`, error);
      }
      
      // Supprimer de la session active
      this.activeTranscriptionSessions.delete(data.commercial_id);
      
      // Notifier la nouvelle session dans l'historique
      this.server.to('audio-streaming').emit('transcription_session_completed', session);
    }
    
    // Diffuser intelligemment l'arrêt du stream
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
    }
  }

  @SubscribeMessage('request_streaming_status')
  handleRequestStreamingStatus(client: Socket) {
    console.log(`🔄 Demande de statut streaming de ${client.id}`);
    
    const activeStreamsArray = Array.from(this.activeStreams.values());
    console.log(`🔄 Streams actifs:`, activeStreamsArray);
    
    client.emit('streaming_status_response', {
      active_streams: activeStreamsArray
    });
  }

  @SubscribeMessage('request_manager_streaming_status')
  async handleRequestManagerStreamingStatus(client: Socket, data: { managerId: string }) {
    console.log(`🔄 Demande streams pour manager ${data.managerId} de ${client.id}`);
    
    // Enregistrer ce manager comme connecté
    this.connectedManagers.set(data.managerId, client.id);
    console.log(`📝 Manager ${data.managerId} enregistré avec socket ${client.id}`);
    
    try {
      // Récupérer les commerciaux du manager
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
            console.log(`⚠️ INCOHÉRENCE: Commercial ${stream.commercial_id} devrait être dans la liste`);
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
      
      // Envoyer l'état filtré des streams au client qui demande
      client.emit('streaming_status_response', {
        active_streams: filteredStreams
      });
    } catch (error) {
      console.error(`❌ Erreur filtrage streams manager ${data.managerId}:`, error);
      client.emit('streaming_status_response', {
        active_streams: []
      });
    }
  }

  // WebRTC signaling relay pour l'écoute
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
    this.server.to(data.to_socket_id).emit('suivi:webrtc_ice_candidate', {
      from_socket_id: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('suivi:leave')
  handleSuiviLeave(client: Socket, data: { to_socket_id: string }) {
    this.server.to(data.to_socket_id).emit('suivi:leave', {
      from_socket_id: client.id,
    });
  }

  // Sauvegarde immédiate d'une session spécifique
  private async saveActiveSessionImmediate(commercialId: string, session: any) {
    try {
      const sessionBackup = {
        ...session,
        end_time: new Date().toISOString(),
        duration_seconds: Math.round((new Date().getTime() - new Date(session.start_time).getTime()) / 1000)
      };

      await this.transcriptionHistoryService.saveSession(sessionBackup, true);
      console.log(`💾 Session active ${commercialId} sauvegardée immédiatement`);
    } catch (error) {
      console.error(`❌ Erreur sauvegarde immédiate ${commercialId}:`, error);
    }
  }

  // Méthodes utilitaires pour l'accès depuis l'extérieur
  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  getActiveStreams(): ActiveStream[] {
    return Array.from(this.activeStreams.values());
  }
}