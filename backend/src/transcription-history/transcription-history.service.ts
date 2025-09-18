

import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextProcessingService } from '../text-processing/text-processing.service';
import { EventEmitterService } from '../events/event-emitter.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
  visited_doors?: string[];
}

@Injectable()
export class TranscriptionHistoryService {
  private processingSessions = new Set<string>(); // Protection contre le traitement multiple

  constructor(
    private prisma: PrismaService,
    private textProcessingService: TextProcessingService,
    @Inject('EventEmitterService') private eventEmitterService: EventEmitterService
  ) {}

  async saveSession(session: TranscriptionSession, skipAI: boolean = false) {
    try {
      console.log('Sauvegarde session dans la base de données:', session.id, 'skipAI:', skipAI, 'transcript length:', session.full_transcript?.length || 0);
      
      // 1. Sauvegarder d'abord la session sans traitement IA
      const savedSession = await this.prisma.transcriptionSession.upsert({
        where: { id: session.id },
        update: {
          commercial_name: session.commercial_name,
          end_time: new Date(session.end_time),
          full_transcript: session.full_transcript, // Texte original
          duration_seconds: session.duration_seconds,
          building_id: session.building_id,
          building_name: session.building_name,
          visited_doors: session.visited_doors || [],
        },
        create: {
          id: session.id,
          commercial_id: session.commercial_id,
          commercial_name: session.commercial_name,
          start_time: new Date(session.start_time),
          end_time: new Date(session.end_time),
          full_transcript: session.full_transcript, // Texte original
          duration_seconds: session.duration_seconds,
          building_id: session.building_id,
          building_name: session.building_name,
          visited_doors: session.visited_doors || [],
        },
      });

      console.log('Session transcription sauvegardée (texte original):', savedSession.id);
      
      // 2. Vérifier si un auto-backup est nécessaire après chaque sauvegarde
      this.checkAutoBackup().catch(error => {
        console.error('❌ Erreur vérification auto-backup:', error);
      });

      // 3. Si il y a du texte et qu'on ne skip pas l'IA, lancer le traitement IA en arrière-plan
      if (!skipAI && session.full_transcript && session.full_transcript.trim().length > 50) {
        // Vérifier si la session n'est pas déjà en cours de traitement
        if (!this.processingSessions.has(session.id)) {
          console.log(`🤖 Traitement IA activé pour session: ${session.id}`);
          this.processingSessions.add(session.id); // Marquer comme en cours de traitement
          
          // Lancer le traitement IA en arrière-plan sans bloquer la sauvegarde
          this.processSessionWithAI(session.id, session.full_transcript).catch(error => {
            console.error(`❌ Erreur traitement IA en arrière-plan pour ${session.id}:`, error);
            this.processingSessions.delete(session.id); // Retirer de la liste en cas d'erreur
            // Ne pas faire échouer la sauvegarde principale
          });
        } else {
          console.log(`⚠️ Session ${session.id} déjà en cours de traitement IA, ignorée`);
        }
      } else if (skipAI) {
        console.log(`⏭️  Traitement IA sauté pour session: ${session.id} (sauvegarde temporaire)`);
      }
      
      console.log('✅ Session sauvegardée avec succès:', savedSession.id);
      return { success: true, sessionId: savedSession.id };
    } catch (error) {
      console.error('❌ Erreur sauvegarde session transcription:', session.id, error);
      console.error('❌ Détails de l\'erreur:', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Traitement IA asynchrone d'une session
   */
  private async processSessionWithAI(sessionId: string, originalText: string) {
    try {
      console.log(`🤖 Début traitement IA pour session: ${sessionId}`);
      
      // Traitement IA
      const processed = await this.textProcessingService.processTranscription(
        originalText,
        {
          useAI: true
        }
      );
      
      // Mettre à jour la session avec le texte traité
      const updatedSession = await this.prisma.transcriptionSession.update({
        where: { id: sessionId },
        data: {
          full_transcript: processed.processedText
        }
      });
      
      console.log(`✅ Traitement IA terminé pour session: ${sessionId} (${processed.processingType})`);
      
      // Retirer la session de la liste de traitement
      this.processingSessions.delete(sessionId);
      
      // Émettre l'événement WebSocket pour notifier le frontend
      try {
        this.eventEmitterService.emitToRoom('audio-streaming', 'transcription_session_updated', {
          id: updatedSession.id,
          commercial_id: updatedSession.commercial_id,
          commercial_name: updatedSession.commercial_name,
          start_time: updatedSession.start_time.toISOString(),
          end_time: updatedSession.end_time.toISOString(),
          full_transcript: updatedSession.full_transcript,
          duration_seconds: updatedSession.duration_seconds,
          building_id: updatedSession.building_id,
          building_name: updatedSession.building_name,
          visited_doors: updatedSession.visited_doors || []
        });
        console.log(`📡 Événement WebSocket émis pour session mise à jour: ${sessionId}`);
      } catch (error) {
        console.error(`❌ Erreur émission WebSocket pour session ${sessionId}:`, error);
      }
      
    } catch (error) {
      console.error(`❌ Erreur traitement IA pour session: ${sessionId}:`, error);
      // En cas d'erreur, on garde le texte original
    }
  }

  async getHistory(commercialId?: string, limit?: number, buildingId?: string): Promise<TranscriptionSession[]> {
    try {
      console.log('Récupération historique transcriptions:', { commercialId, buildingId, limit });
      
      // Construire les conditions de filtrage
      const whereConditions: any = {};
      
      if (commercialId) {
        whereConditions.commercial_id = commercialId;
      }
      
      if (buildingId) {
        whereConditions.building_id = buildingId;
      }
      
      const queryOptions: any = {
        where: Object.keys(whereConditions).length > 0 ? whereConditions : undefined,
        orderBy: { createdAt: 'desc' },
      };
      
      if (limit) {
        queryOptions.take = limit;
      }
      
      const sessions = await this.prisma.transcriptionSession.findMany(queryOptions);

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
        visited_doors: session.visited_doors || [],
      }));
      
      console.log('Historique récupéré:', history.length, 'sessions', buildingId ? `pour immeuble ${buildingId}` : '');
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
          useAI: true
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
    // Simplification : retourner directement le chunk sans traitement complexe
    const newCommitted = committed + (committed && !committed.endsWith(' ') ? ' ' : '') + chunk;
    
    // Limiter la longueur si nécessaire
    const finalCommitted = newCommitted.length > maxChars 
      ? newCommitted.slice(newCommitted.length - maxChars) 
      : newCommitted;
    
    return {
      processedChunk: chunk,
      newCommitted: finalCommitted,
      shouldFinalize: isFinal
    };
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

  /**
   * Vérifie si un backup automatique est nécessaire
   */
  async checkAutoBackup() {
    try {
      const MAX_SESSIONS = 1000; // Limite de sessions
      const MAX_SIZE_MB = 50;    // Limite en MB (estimation texte)

      const totalSessions = await this.prisma.transcriptionSession.count();

      if (totalSessions >= MAX_SESSIONS) {
        console.log(`🔄 Auto-backup déclenché: ${totalSessions} sessions (limite: ${MAX_SESSIONS})`);
        const result = await this.backupToS3(true); // Auto-backup
        return result;
      }

      // Vérifier la taille approximative (estimation : 1KB par session en moyenne)
      const estimatedSizeMB = totalSessions * 1 / 1024; // Estimation grossière
      if (estimatedSizeMB >= MAX_SIZE_MB) {
        console.log(`🔄 Auto-backup déclenché: ~${estimatedSizeMB.toFixed(1)}MB (limite: ${MAX_SIZE_MB}MB)`);
        const result = await this.backupToS3(true); // Auto-backup
        return result;
      }

      return { autoBackupNeeded: false, totalSessions, estimatedSizeMB };
    } catch (error) {
      console.error('❌ Erreur vérification auto-backup:', error);
      return { error: error.message };
    }
  }

  /**
   * Sauvegarde toutes les transcriptions vers S3 en format PDF
   */
  async backupToS3(isAutoBackup = false) {
    try {
      console.log('🗄️ Début de la sauvegarde S3 des transcriptions (PDF)');

      // Configuration S3
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'eu-west-3',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        }
      });

      // Récupérer toutes les transcriptions
      const transcriptions = await this.prisma.transcriptionSession.findMany({
        orderBy: { start_time: 'desc' }
      });

      console.log(`📊 ${transcriptions.length} transcriptions à sauvegarder`);

      if (transcriptions.length === 0) {
        return {
          success: true,
          message: 'Aucune transcription à sauvegarder',
          count: 0
        };
      }

      // Générer le PDF
      const pdfBuffer = await this.generateTranscriptionsPdf(transcriptions);

      // Nom du fichier avec timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `transcriptions-backup-${timestamp}.pdf`;

      // Upload vers S3
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `backups/transcriptions/${fileName}`,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          'backup-type': 'transcriptions-pdf',
          'session-count': transcriptions.length.toString(),
          'exported-at': new Date().toISOString()
        }
      });

      await s3Client.send(command);

      console.log(`✅ Sauvegarde PDF S3 terminée: ${fileName}`);

      // Si c'est un auto-backup et que la sauvegarde a réussi, nettoyer la DB
      let cleanupResult = null;
      if (isAutoBackup) {
        console.log('🧹 Nettoyage automatique de la DB après backup réussi...');
        cleanupResult = await this.cleanupAfterBackup(transcriptions.map(t => t.id));
      }

      return {
        success: true,
        message: `Sauvegarde PDF S3 effectuée avec succès`,
        fileName,
        transcriptionsCount: transcriptions.length,
        backupSize: pdfBuffer.length,
        isAutoBackup,
        cleanupResult
      };

    } catch (error) {
      console.error('❌ Erreur sauvegarde PDF S3:', error);
      return {
        success: false,
        error: error.message,
        message: 'Erreur lors de la sauvegarde PDF S3'
      };
    }
  }

  /**
   * Génère un PDF de toutes les transcriptions
   */
  private async generateTranscriptionsPdf(sessions: any[]): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;

      // En-tête du document
      doc.fontSize(24).fillColor('#0f172a').text('Sauvegarde des Transcriptions', left, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#6b7280')
         .text(`Générée le: ${new Date().toLocaleString('fr-FR')}`)
         .text(`Total: ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`);
      doc.moveDown(1);

      // Grouper par commercial
      const sessionsByCommercial = new Map();
      sessions.forEach(session => {
        const name = session.commercial_name || `Commercial ${session.commercial_id}`;
        if (!sessionsByCommercial.has(name)) {
          sessionsByCommercial.set(name, []);
        }
        sessionsByCommercial.get(name).push(session);
      });

      // Parcourir chaque commercial
      sessionsByCommercial.forEach((commercialSessions, commercialName) => {
        // Section commercial
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }

        doc.fontSize(16).fillColor('#1f2937')
           .text(`Commercial: ${commercialName}`, left, doc.y);
        doc.fontSize(10).fillColor('#6b7280')
           .text(`${commercialSessions.length} session${commercialSessions.length !== 1 ? 's' : ''}`);
        doc.moveDown(0.5);

        // Tracer une ligne
        doc.strokeColor('#e5e7eb').lineWidth(1)
           .moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).stroke();
        doc.moveDown(0.5);

        // Parcourir les sessions du commercial
        commercialSessions.forEach((session: any, index: number) => {
          // Vérifier si on a assez d'espace
          if (doc.y > doc.page.height - 200) {
            doc.addPage();
          }

          const start = this.fmtDateTime(session.start_time);
          const end = this.fmtDateTime(session.end_time);
          const duration = this.fmtDuration(session.duration_seconds);
          const building = session.building_name ? `Batiment: ${session.building_name}` : '';
          const doors = session.visited_doors && session.visited_doors.length > 0
            ? `Portes: ${session.visited_doors.join(', ')}`
            : '';

          // Titre session
          doc.fontSize(12).fillColor('#374151')
             .text(`Session ${index + 1}`, left, doc.y, { continued: true });
          doc.fillColor('#6b7280')
             .text(`  •  ${start} → ${end}  •  ${duration}`);

          // Informations bâtiment/portes
          if (building || doors) {
            doc.fontSize(10).fillColor('#9ca3af')
               .text([building, doors].filter(Boolean).join('  '), left + 10);
          }

          // Transcription
          if (session.full_transcript) {
            doc.moveDown(0.3);
            const transcript = session.full_transcript.trim();
            if (transcript) {
              // Limiter à 500 caractères pour éviter des pages trop longues
              const truncated = transcript.length > 500
                ? transcript.substring(0, 500) + '...'
                : transcript;

              doc.fontSize(9).fillColor('#4b5563')
                 .text(`Transcription: ${truncated}`, left + 10, doc.y, {
                   width: pageWidth - 20,
                   align: 'justify'
                 });
            }
          }

          doc.moveDown(0.8);
        });

        doc.moveDown(1);
      });

      // Pied de page final
      doc.fontSize(8).fillColor('#9ca3af')
         .text(`Fin du document - ${sessions.length} sessions sauvegardées`,
               left, doc.page.height - 60, { align: 'center' });

      doc.end();
    });
  }

  private fmtDateTime = (d: any) => {
    try {
      const date = d instanceof Date ? d : new Date(d);
      return date.toLocaleString('fr-FR');
    } catch {
      return String(d ?? '');
    }
  };

  private fmtDuration = (sec: number) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m${r.toString().padStart(2, '0')}`;
  };

  /**
   * Nettoie les transcriptions de la DB après backup réussi
   */
  private async cleanupAfterBackup(sessionIds: string[]) {
    try {
      console.log(`🧹 Suppression de ${sessionIds.length} sessions de la DB...`);

      // Garder les 100 sessions les plus récentes par sécurité
      const recentSessions = await this.prisma.transcriptionSession.findMany({
        select: { id: true },
        orderBy: { start_time: 'desc' },
        take: 100
      });

      const recentIds = recentSessions.map(s => s.id);
      const toDelete = sessionIds.filter(id => !recentIds.includes(id));

      if (toDelete.length === 0) {
        console.log('⚠️ Aucune session ancienne à supprimer (toutes récentes)');
        return { deleted: 0, kept: sessionIds.length };
      }

      const deleteResult = await this.prisma.transcriptionSession.deleteMany({
        where: {
          id: {
            in: toDelete
          }
        }
      });

      console.log(`✅ ${deleteResult.count} sessions supprimées, ${recentIds.length} récentes conservées`);

      return {
        deleted: deleteResult.count,
        kept: sessionIds.length - deleteResult.count,
        totalProcessed: sessionIds.length
      };

    } catch (error) {
      console.error('❌ Erreur nettoyage DB:', error);
      return {
        error: error.message,
        deleted: 0,
        kept: sessionIds.length
      };
    }
  }

} 