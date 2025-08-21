import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextProcessingService } from '../text-processing/text-processing.service';

export interface TranscriptionSession {
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

@Injectable()
export class TranscriptionHistoryService {
  constructor(
    private prisma: PrismaService,
    private textProcessingService: TextProcessingService
  ) {}

  async saveSession(session: TranscriptionSession) {
    try {
      console.log('Sauvegarde session dans la base de données:', session.id);
      
      // Traitement centralisé du texte (basique + IA)
      let processedTranscript = session.full_transcript;
      
      if (session.full_transcript && session.full_transcript.trim().length > 0) {
        try {
          console.log('Traitement centralisé de la transcription...');
          const processed = await this.textProcessingService.processTranscription(
            session.full_transcript,
            {
              useAI: true,
              minLengthForAI: 50
            }
          );
          
          processedTranscript = processed.processedText;
          console.log(`Transcription traitée (${processed.processingType}) - ${processed.wordCount} mots`);
          
        } catch (processingError) {
          console.error('Erreur traitement texte, sauvegarde du texte original:', processingError.message);
          // En cas d'erreur, on garde le texte original
          processedTranscript = session.full_transcript;
        }
      } else {
        console.log('Transcription vide, pas de traitement');
      }
      
      // Utiliser upsert pour éviter les doublons
      const savedSession = await this.prisma.transcriptionSession.upsert({
        where: { id: session.id },
        update: {
          commercial_name: session.commercial_name,
          end_time: new Date(session.end_time),
          full_transcript: processedTranscript,
          duration_seconds: session.duration_seconds,
          building_id: session.building_id,
          building_name: session.building_name,
          last_door_label: session.last_door_label,
        },
        create: {
          id: session.id,
          commercial_id: session.commercial_id,
          commercial_name: session.commercial_name,
          start_time: new Date(session.start_time),
          end_time: new Date(session.end_time),
          full_transcript: processedTranscript,
          duration_seconds: session.duration_seconds,
          building_id: session.building_id,
          building_name: session.building_name,
          last_door_label: session.last_door_label,
        },
      });

      console.log('Session transcription sauvegardée avec traitement Gemini:', savedSession.id);
      
      return { success: true, sessionId: savedSession.id };
    } catch (error) {
      console.error('Erreur sauvegarde session transcription:', error);
      throw error;
    }
  }

  async getHistory(commercialId?: string, limit: number = 50): Promise<TranscriptionSession[]> {
    try {
      console.log('Récupération historique transcriptions:', { commercialId, limit });
      
      const sessions = await this.prisma.transcriptionSession.findMany({
        where: commercialId ? { commercial_id: commercialId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const history: TranscriptionSession[] = sessions.map((session: any) => ({
        id: session.id,
        commercial_id: session.commercial_id,
        commercial_name: session.commercial_name,
        start_time: session.start_time.toISOString(),
        end_time: session.end_time.toISOString(),
        full_transcript: session.full_transcript,
        duration_seconds: session.duration_seconds,
        building_id: session.building_id,
        building_name: session.building_name,
        last_door_label: session.last_door_label,
      }));
      
      console.log('Historique récupéré:', history.length, 'sessions');
      return history;
    } catch (error) {
      console.error('Erreur récupération historique:', error);
      return [];
    }
  }

  async deleteSession(id: string) {
    try {
      console.log('Suppression session transcription:', id);
      
      await this.prisma.transcriptionSession.delete({
        where: { id },
      });
      
      console.log('Session transcription supprimée');
      return { success: true };
    } catch (error) {
      console.error('Erreur suppression session:', error);
      throw error;
    }
  }

  async getCommercialName(commercialId: string): Promise<string> {
    try {
      const commercial = await this.prisma.commercial.findUnique({
        where: { id: commercialId }
      });
      if (commercial) {
        return `${commercial.prenom} ${commercial.nom}`;
      }
      return `Commercial ${commercialId}`;
    } catch (error) {
      console.error('❌ Erreur récupération nom commercial:', error);
      return `Commercial ${commercialId}`;
    }
  }

  async getAllCommercials(): Promise<Array<{id: string, name: string, sessionsCount: number, lastTime: number}>> {
    try {
      console.log('👥 Récupération de tous les commerciaux');
      
      // Récupérer tous les commerciaux de la base de données
      const commercials = await this.prisma.commercial.findMany({
        select: {
          id: true,
          prenom: true,
          nom: true
        }
      });

      // Récupérer les statistiques de sessions pour chaque commercial
      const commercialsWithStats = await Promise.all(
        commercials.map(async (commercial) => {
          const sessionsCount = await this.prisma.transcriptionSession.count({
            where: { commercial_id: commercial.id }
          });

          const lastSession = await this.prisma.transcriptionSession.findFirst({
            where: { commercial_id: commercial.id },
            orderBy: { start_time: 'desc' }
          });

          return {
            id: commercial.id,
            name: `${commercial.prenom} ${commercial.nom}`,
            sessionsCount,
            lastTime: lastSession ? new Date(lastSession.start_time).getTime() : 0
          };
        })
      );

      console.log(`${commercialsWithStats.length} commerciaux récupérés`);
      return commercialsWithStats;
    } catch (error) {
      console.error('Erreur récupération commerciaux:', error);
      return [];
    }
  }

  async syncSessionIfShorter(sessionId: string, localTranscript: string) {
    try {
      console.log('📚 Synchronisation session transcription:', sessionId);
      
      // Récupérer la session actuelle
      const currentSession = await this.prisma.transcriptionSession.findUnique({
        where: { id: sessionId }
      });

      if (!currentSession) {
        console.log('❌ Session non trouvée:', sessionId);
        return { success: false, error: 'Session not found' };
      }

      const currentLength = currentSession.full_transcript?.length || 0;
      const localLength = localTranscript.length;

      console.log(`📊 Comparaison longueurs - Serveur: ${currentLength}, Local: ${localLength}`);

      // Si la version locale est significativement plus longue, on la sauvegarde
      if (localLength > currentLength + 10) {
        console.log('✅ Mise à jour avec la version locale (plus longue)');
        
        await this.prisma.transcriptionSession.update({
          where: { id: sessionId },
          data: {
            full_transcript: localTranscript,
            updatedAt: new Date()
          }
        });

        return { 
          success: true, 
          updated: true, 
          previousLength: currentLength, 
          newLength: localLength 
        };
      } else {
        console.log('ℹ️ Version serveur suffisante, pas de mise à jour');
        return { 
          success: true, 
          updated: false, 
          serverLength: currentLength, 
          localLength: localLength 
        };
      }
    } catch (error) {
      console.error('Erreur synchronisation session:', error);
      throw error;
    }
  }

  async restructureTranscription(sessionId: string): Promise<{success: boolean, message?: string, error?: string}> {
    try {
      console.log('Restructuration transcription pour session:', sessionId);
      
      // Récupérer la session
      const session = await this.prisma.transcriptionSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return { success: false, error: 'Session non trouvée' };
      }

      if (!session.full_transcript || session.full_transcript.trim().length === 0) {
        return { success: false, error: 'Aucune transcription à restructurer' };
      }

      // Utiliser le service de traitement centralisé
      const processed = await this.textProcessingService.processTranscription(
        session.full_transcript,
        {
          useAI: true,
          minLengthForAI: 10 // Plus permissif pour la restructuration manuelle
        }
      );

      // Remplacer la transcription originale par la version traitée
      await this.prisma.transcriptionSession.update({
        where: { id: sessionId },
        data: {
          full_transcript: processed.processedText,
          updatedAt: new Date()
        }
      });

      console.log(`Transcription restructurée avec succès (${processed.processingType})`);
      return { 
        success: true, 
        message: `Transcription restructurée avec succès (${processed.processingType}) - ${processed.wordCount} mots`
      };

    } catch (error) {
      console.error('Erreur restructuration transcription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Traitement en temps réel pour la transcription live
   */
  processLiveText(text: string) {
    return this.textProcessingService.processLiveTranscription(text);
  }

  /**
   * Traitement chunk live avec merge intelligent
   */
  processLiveChunk(chunk: string, committed: string = '', isFinal: boolean = false, maxChars: number = 8000) {
    return this.textProcessingService.processLiveChunk(chunk, committed, isFinal, maxChars);
  }

  /**
   * Obtenir les statistiques d'une transcription
   */
  async getTranscriptionStats(sessionId: string) {
    try {
      const session = await this.prisma.transcriptionSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return { success: false, error: 'Session non trouvée' };
      }

      const stats = this.textProcessingService.getTextStats(session.full_transcript);
      
      return {
        success: true,
        stats: {
          ...stats,
          duration: session.duration_seconds,
          building: session.building_name,
          commercial: session.commercial_name
        }
      };
    } catch (error) {
      console.error('Erreur récupération stats:', error);
      return { success: false, error: error.message };
    }
  }

} 