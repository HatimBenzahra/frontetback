import { WebSocketGateway, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import * as https from 'https';
import { IncomingMessage, RequestOptions } from 'http';
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

  // Deepgram streaming state
  private dgStreams = new Map<string, {
    req: import('http').ClientRequest;
    res: IncomingMessage | null;
    startedAt: number;
    lastDoorId?: string;
    lastDoorLabel?: string;
  }>();

  // Minimal per-session per-door aggregation
  private sessionDoorTexts = new Map<string, Map<string, string>>();

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
  async handleTranscriptionStart(client: Socket, data: {
    commercial_id: string;
    building_id?: string;
    building_name?: string;
    mime_type?: string;
  }) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('❌ DEEPGRAM_API_KEY is not set in backend env');
      client.emit('transcription_error', { message: 'Deepgram API key is missing on server' });
      return;
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
  @UseGuards(WsRolesGuard)
  @Roles('commercial', 'manager')
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
  @UseGuards(WsRolesGuard)
  @Roles('commercial')
  handleTranscriptionStop(client: Socket, data: { commercial_id: string }) {
    const state = this.dgStreams.get(data.commercial_id);
    if (!state) return;
    try {
      state.req.end();
    } catch {}
    this.dgStreams.delete(data.commercial_id);
    console.log(`🛑 Deepgram streaming stopped for ${data.commercial_id}`);
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