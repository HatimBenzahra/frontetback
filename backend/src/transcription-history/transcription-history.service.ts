import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';

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
    private geminiService: GeminiService
  ) {}

  async saveSession(session: TranscriptionSession) {
    try {
      console.log('📚 Sauvegarde session dans la base de données:', session.id);
      
      // Traiter le texte avec Gemini avant sauvegarde si la transcription n'est pas vide
      let processedTranscript = session.full_transcript;
      
      if (session.full_transcript && session.full_transcript.trim().length > 50) {
        try {
          console.log('🤖 Traitement de la transcription avec Gemini...');
          processedTranscript = await this.geminiService.restructureDialogue(session.full_transcript);
          console.log('✅ Transcription restructurée avec Gemini');
        } catch (geminiError) {
          console.error('⚠️ Erreur Gemini, sauvegarde du texte original:', geminiError.message);
          // En cas d'erreur Gemini, on garde le texte original
          processedTranscript = session.full_transcript;
        }
      } else {
        console.log('📝 Transcription trop courte, pas de traitement Gemini');
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

      console.log('✅ Session transcription sauvegardée avec traitement Gemini:', savedSession.id);
      
      return { success: true, sessionId: savedSession.id };
    } catch (error) {
      console.error('❌ Erreur sauvegarde session transcription:', error);
      throw error;
    }
  }

  async getHistory(commercialId?: string, limit: number = 50): Promise<TranscriptionSession[]> {
    try {
      console.log('📚 Récupération historique transcriptions:', { commercialId, limit });
      
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
      
      console.log('✅ Historique récupéré:', history.length, 'sessions');
      return history;
    } catch (error) {
      console.error('❌ Erreur récupération historique:', error);
      return [];
    }
  }

  async deleteSession(id: string) {
    try {
      console.log('📚 Suppression session transcription:', id);
      
      await this.prisma.transcriptionSession.delete({
        where: { id },
      });
      
      console.log('✅ Session transcription supprimée');
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur suppression session:', error);
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

      console.log(`✅ ${commercialsWithStats.length} commerciaux récupérés`);
      return commercialsWithStats;
    } catch (error) {
      console.error('❌ Erreur récupération commerciaux:', error);
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
      console.error('❌ Erreur synchronisation session:', error);
      throw error;
    }
  }

  async restructureTranscription(sessionId: string): Promise<{success: boolean, message?: string, error?: string}> {
    try {
      console.log('🤖 Restructuration transcription pour session:', sessionId);
      
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

      // Utiliser Gemini pour restructurer
      const restructuredTranscript = await this.geminiService.restructureDialogue(session.full_transcript);

      // Remplacer la transcription originale par la version restructurée
      await this.prisma.transcriptionSession.update({
        where: { id: sessionId },
        data: {
          full_transcript: restructuredTranscript,
          updatedAt: new Date()
        }
      });

      console.log('✅ Transcription restructurée et remplacée avec succès');
      return { success: true, message: 'Transcription restructurée avec succès' };

    } catch (error) {
      console.error('❌ Erreur restructuration transcription:', error);
      return { success: false, error: error.message };
    }
  }

} 