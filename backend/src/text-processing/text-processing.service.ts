import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';

export interface ProcessedTranscription {
  originalText: string;
  processedText: string;
  processingType: 'ai_enhanced' | 'failed';
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  speakers?: string[];
  isDialogue: boolean;
  processingTime?: number;
}

@Injectable()
export class TextProcessingService {
  private readonly logger = new Logger(TextProcessingService.name);

  constructor(private geminiService: GeminiService) {}

  async processTranscription(
    rawText: string,
    options: {
      useAI?: boolean;
    } = {}
  ): Promise<ProcessedTranscription> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Début traitement texte IA: ${rawText.length} caractères (toujours actif)`);
      
      // Options par défaut
      const {
        useAI = true
      } = options;

      let finalText = rawText;
      let processingType: 'ai_enhanced' | 'failed' = 'failed';

      // TRAITEMENT IA TOUJOURS ACTIF
      if (useAI) {
        try {
          this.logger.log('Lancement traitement IA...');
          const aiEnhanced = await this.geminiService.restructureDialogue(rawText);
          
          if (aiEnhanced && aiEnhanced.trim().length > 0) {
            finalText = aiEnhanced;
            processingType = 'ai_enhanced';
            this.logger.log('Traitement IA réussi');
          } else {
            this.logger.warn('IA a retourné un texte vide, conservation du texte original');
            finalText = rawText;
          }
        } catch (aiError) {
          this.logger.error('Erreur traitement IA:', aiError.message);
          processingType = 'failed';
          finalText = rawText;
        }
      } else {
        this.logger.log('Traitement IA désactivé, conservation du texte original');
        finalText = rawText;
      }
      
      // ANALYSE FINALE
      const finalAnalysis = this.analyzeText(finalText);
      const processingTime = Date.now() - startTime;

      const result: ProcessedTranscription = {
        originalText: rawText,
        processedText: finalText,
        processingType,
        wordCount: finalAnalysis.wordCount,
        characterCount: finalAnalysis.characterCount,
        paragraphCount: finalAnalysis.paragraphCount,
        speakers: finalAnalysis.speakers,
        isDialogue: finalAnalysis.isDialogue,
        processingTime
      };

      this.logger.log(`Traitement terminé en ${processingTime}ms - Type: ${processingType}`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Erreur générale traitement texte:', error);
      
      return {
        originalText: rawText,
        processedText: rawText,
        processingType: 'failed',
        wordCount: rawText.split(/\s+/).filter(w => w.length > 0).length,
        characterCount: rawText.length,
        paragraphCount: 1,
        isDialogue: false,
        processingTime
      };
    }
  }

  /**
   * Analyser le contenu du texte
   */
  private analyzeText(text: string) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    // Détecter les interlocuteurs (format **Nom:**)
    const speakerMatches = text.match(/\*\*([^*]+)\s*:\*\*/g) || [];
    const speakers = speakerMatches.map(match => 
      match.replace(/\*\*/g, '').replace(':', '').trim()
    ).filter((speaker, index, arr) => arr.indexOf(speaker) === index);

    const isDialogue = speakers.length >= 2;

    return {
      wordCount: words.length,
      characterCount: text.length,
      paragraphCount: Math.max(paragraphs.length, 1),
      speakers,
      isDialogue
    };
  }

  /**
   * Traitement en temps réel (pour la transcription live)
   */
  processLiveTranscription(text: string): {
    displayText: string;
    stats: { words: number; chars: number; }
  } {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    return {
      displayText: text,
      stats: {
        words: words.length,
        chars: text.length
      }
    };
  }

  /**
   * Extraire les statistiques d'un texte
   */
  getTextStats(text: string) {
    const analysis = this.analyzeText(text);
    
    return {
      characters: analysis.characterCount,
      words: analysis.wordCount,
      paragraphs: analysis.paragraphCount,
      speakers: analysis.speakers,
      isDialogue: analysis.isDialogue,
      estimatedReadingTime: Math.ceil(analysis.wordCount / 200) // 200 mots/minute
    };
  }
}