import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { TranscriptionHistoryService, TranscriptionSession } from './transcription-history.service';

@Controller('api/transcription-history')
export class TranscriptionHistoryController {
  constructor(private readonly transcriptionHistoryService: TranscriptionHistoryService) {}

  @Post()
  async saveTranscriptionSession(@Body() session: TranscriptionSession) {
    console.log('📚 Sauvegarde session transcription reçue:', session);
    return this.transcriptionHistoryService.saveSession(session);
  }

  @Get()
  async getTranscriptionHistory(
    @Query('commercial_id') commercialId?: string,
    @Query('limit') limit?: string
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : 50;
    console.log('📚 Récupération historique transcriptions:', { commercialId, limit: limitNumber });
    const history = await this.transcriptionHistoryService.getHistory(commercialId, limitNumber);
    return { history };
  }

  @Get('commercials')
  async getAllCommercials() {
    console.log('👥 Récupération de tous les commerciaux');
    const commercials = await this.transcriptionHistoryService.getAllCommercials();
    return { commercials };
  }

  @Delete(':id')
  async deleteTranscriptionSession(@Param('id') id: string) {
    console.log('📚 Suppression session transcription:', id);
    return this.transcriptionHistoryService.deleteSession(id);
  }
} 