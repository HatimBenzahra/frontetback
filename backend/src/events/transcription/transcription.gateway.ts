import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { TranscriptionHistoryService } from '../../transcription-history/transcription-history.service';
import { websocketConfig } from '../websocket.config';
import { WsAuthGuard } from '../../auth/ws-auth.guard';
import { WsRolesGuard } from '../../auth/ws-roles.guard';
import { Roles } from '../../auth/roles.decorator';

@WebSocketGateway(websocketConfig)
@UseGuards(WsAuthGuard)
export class TranscriptionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private transcriptionHistoryService: TranscriptionHistoryService) {}

  handleConnection(client: Socket) {
    console.log(`📝 Transcription client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`📝 Transcription client disconnected: ${client.id}`);
  }

  @SubscribeMessage('transcription_update')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleTranscriptionUpdate(_client: Socket, data: {
    commercial_id: string;
    transcript: string;
    is_final: boolean;
    timestamp: string;
    door_id?: string;
    door_label?: string;
  }) {
    const doorInfo = data.door_label ? data.door_label : (data.door_id ?? 'n/a');
    console.log(`📝 Transcription de ${data.commercial_id}: "${data.transcript}" (final: ${data.is_final}) porte=${doorInfo}`);

    // Diffuser la transcription aux admins dans la room audio-streaming
    this.server.to('audio-streaming').emit('transcription_update', data);
  }

  @SubscribeMessage('transcription_start')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleTranscriptionStart(client: Socket, data: {
    commercial_id: string;
    building_id?: string;
    building_name?: string;
    source?: string;
  }) {
    console.log(`🎧 Transcription navigateur démarrée pour ${data.commercial_id} (source: ${data.source || 'inconnue'})`);
    // Nothing to initialize here for now; this gateway simply relaye les updates.
  }

  @SubscribeMessage('transcription_stop')
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleTranscriptionStop(client: Socket, data: { commercial_id: string }) {
    console.log(`🛑 Transcription navigateur arrêtée pour ${data.commercial_id}`);
  }

  @SubscribeMessage('request_transcription_history')
  @UseGuards(WsRolesGuard)
  @Roles('admin', 'manager')
  async handleRequestTranscriptionHistory(client: Socket, data?: { commercial_id?: string }) {
    console.log(`📚 Demande d'historique des transcriptions de ${client.id}`);
    
    try {
      const history = await this.transcriptionHistoryService.getHistory(data?.commercial_id, 100);
      console.log(`📚 Historique récupéré de la DB: ${history.length} sessions`);
      client.emit('transcription_history_response', { history });
    } catch (error) {
      console.error('❌ Erreur récupération historique DB:', error);
      client.emit('transcription_history_response', { history: [] });
    }
  }

  // Méthodes utilitaires pour l'accès depuis l'extérieur
  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  // Fonction utilitaire pour nettoyer les transcriptions
  cleanAndDeduplicateTranscript(currentText: string, newText: string): string {
    const cleanNewText = newText.trim();
    if (!cleanNewText) return currentText;
    
    if (currentText.endsWith(cleanNewText)) {
      return currentText;
    }
    
    if (cleanNewText.includes(currentText) && currentText.length > 0) {
      return cleanNewText;
    }
    
    const separator = currentText && !currentText.endsWith(' ') ? ' ' : '';
    return currentText + separator + cleanNewText;
  }
}
