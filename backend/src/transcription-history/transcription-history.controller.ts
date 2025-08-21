import { Controller, Post, Get, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { TranscriptionHistoryService, TranscriptionSession } from './transcription-history.service';

@Controller('api/transcription-history')
export class TranscriptionHistoryController {
  constructor(private readonly transcriptionHistoryService: TranscriptionHistoryService) {}

  @Post()
  async saveTranscriptionSession(@Body() session: TranscriptionSession) {
    console.log('Sauvegarde session transcription reçue:', session);
    return this.transcriptionHistoryService.saveSession(session);
  }

  @Get()
  async getTranscriptionHistory(
    @Query('commercial_id') commercialId?: string,
    @Query('limit') limit?: string
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : 50;
    console.log('Récupération historique transcriptions:', { commercialId, limit: limitNumber });
    const history = await this.transcriptionHistoryService.getHistory(commercialId, limitNumber);
    return { history };
  }

  @Get('commercials')
  async getAllCommercials() {
    console.log('Récupération de tous les commerciaux');
    const commercials = await this.transcriptionHistoryService.getAllCommercials();
    return { commercials };
  }

  @Delete(':id')
  async deleteTranscriptionSession(@Param('id') id: string) {
    console.log('Suppression session transcription:', id);
    return this.transcriptionHistoryService.deleteSession(id);
  }

  @Patch(':id/sync')
  async syncTranscriptionSession(
    @Param('id') id: string,
    @Body() data: { full_transcript: string }
  ) {
    console.log('Synchronisation session transcription:', id, 'longueur:', data.full_transcript.length);
    return this.transcriptionHistoryService.syncSessionIfShorter(id, data.full_transcript);
  }

  @Post(':id/restructure')
  async restructureTranscription(@Param('id') id: string) {
    console.log('Restructuration transcription demandée pour session:', id);
    return this.transcriptionHistoryService.restructureTranscription(id);
  }

  @Get(':id/stats')
  async getTranscriptionStats(@Param('id') id: string) {
    console.log('Statistiques demandées pour session:', id);
    return this.transcriptionHistoryService.getTranscriptionStats(id);
  }

  @Post('process-live')
  async processLiveText(@Body() data: { text: string }) {
    console.log('⚡ Traitement texte en temps réel:', data.text.length, 'caractères');
    return this.transcriptionHistoryService.processLiveText(data.text);
  }

  @Post('process-chunk')
  async processLiveChunk(@Body() data: { 
    chunk: string; 
    committed?: string; 
    isFinal?: boolean; 
    maxChars?: number 
  }) {
    console.log('⚡ Traitement chunk live:', data.chunk.length, 'caractères, final:', data.isFinal);
    return this.transcriptionHistoryService.processLiveChunk(
      data.chunk, 
      data.committed || '', 
      data.isFinal || false, 
      data.maxChars || 8000
    );
  }
} 