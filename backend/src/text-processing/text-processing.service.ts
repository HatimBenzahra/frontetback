import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';

export interface ProcessedTranscription {
  originalText: string;
  processedText: string;
  processingType: 'basic' | 'ai_enhanced' | 'failed';
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
      minLengthForAI?: number;
      basicProcessingOnly?: boolean;
    } = {}
  ): Promise<ProcessedTranscription> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`📝 Début traitement texte: ${rawText.length} caractères`);
      
      // Options par défaut
      const {
        useAI = true,
        minLengthForAI = 50,
        basicProcessingOnly = false
      } = options;

      // 1. TRAITEMENT BASIQUE OBLIGATOIRE
      const basicProcessed = this.basicTextProcessing(rawText);
      
      // 2. ANALYSE DU TEXTE
      const textAnalysis = this.analyzeText(basicProcessed);
      
      let finalText = basicProcessed;
      let processingType: 'basic' | 'ai_enhanced' | 'failed' = 'basic';

      // 3. TRAITEMENT IA (si activé et conditions remplies)
      if (!basicProcessingOnly && useAI && rawText.length >= minLengthForAI) {
        try {
          this.logger.log('Lancement traitement IA...');
          const aiEnhanced = await this.geminiService.restructureDialogue(basicProcessed);
          
          if (aiEnhanced && aiEnhanced.trim().length > 0) {
            finalText = this.cleanAIOutput(aiEnhanced);
            processingType = 'ai_enhanced';
            this.logger.log('Traitement IA réussi');
          } else {
            this.logger.warn('IA a retourné un texte vide, conservation du traitement basique');
          }
        } catch (aiError) {
          this.logger.error('Erreur traitement IA:', aiError.message);
          processingType = 'failed';
          // On garde le traitement basique
        }
      } else {
        this.logger.log('Traitement basique seulement (IA désactivée ou texte trop court)');
      }

      // 4. FORMATAGE FINAL AUTOMATIQUE avec retours à la ligne
      finalText = this.formatDialogueWithLineBreaks(finalText);
      
      // 5. ANALYSE FINALE
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
        processedText: this.basicTextProcessing(rawText),
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
   * Traitement basique du texte (toujours appliqué)
   * Inclut la logique qui était dans le frontend
   */
  private basicTextProcessing(text: string): string {
    if (!text || text.trim().length === 0) return '';

    let processed = text;

    // 1. Nettoyage des espaces
    processed = this.cleanChunk(processed);

    // 2. Dictionnaire de corrections (ex-frontend)
    processed = this.applyDictionary(processed);

    // 3. Normalisation intelligente (ex-frontend)
    processed = this.smartNormalize(processed);

    // 4. Nettoyages supplémentaires
    processed = processed
      // Nettoyer les caractères spéciaux problématiques
      .replace(/[^\w\s\-.,!?;:()'"àáâäèéêëìíîïòóôöùúûüÿç€%]/gi, ' ')
      // Corriger la ponctuation de base
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\s*([.,!?;:])/g, '$1 $2')
      // Capitaliser le début
      .replace(/^./, match => match.toUpperCase())
      // Nettoyer les espaces en début/fin
      .trim();

    return processed;
  }

  /**
   * Nettoyer un chunk de texte (ex-frontend)
   */
  private cleanChunk(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Appliquer le dictionnaire de corrections (ex-frontend)
   */
  private applyDictionary(text: string): string {
    const DICTIONARY_ENTRIES: Array<[RegExp, string]> = [
      [/winvest/gi, 'Winvest'],
      [/finanss?or/gi, 'FINANSSOR'],
      [/orly/gi, 'Orly'],
      [/rdv/gi, 'RDV'],
      [/idfa/gi, 'IDFA'],
    ];

    let output = text;
    for (const [regex, replacement] of DICTIONARY_ENTRIES) {
      output = output.replace(regex, replacement);
    }
    return output;
  }

  /**
   * Normalisation intelligente (ex-frontend)
   */
  private smartNormalize(text: string): string {
    const FRENCH_NUMBER_MAP: Record<string, string> = {
      'zéro': '0', 'un': 'un', 'une': '1', 'deux': '2', 'trois': '3', 'quatre': '4', 'cinq': '5',
      'six': '6', 'sept': '7', 'huit': '8', 'neuf': '9', 'dix': '10', 'onze': '11', 'douze': '12',
      'treize': '13', 'quatorze': '14', 'quinze': '15', 'seize': '16', 'vingt': '20', 'trente': '30',
      'quarante': '40', 'cinquante': '50', 'soixante': '60', 'soixante-dix': '70', 'soixante dix': '70',
      'quatre-vingt': '80', 'quatre vingt': '80', 'quatre-vingt-dix': '90', 'quatre vingt dix': '90',
    };

    let output = text;
    
    // Conversion des nombres français
    output = output.replace(
      /\b(zéro|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante(?:[- ]dix)?|quatre(?:[- ]vingt(?:[- ]dix)?)?)\b/gi,
      (match) => {
        const key = match.toLowerCase();
        return FRENCH_NUMBER_MAP[key] ?? match;
      }
    );

    // Formatage monétaire
    output = output.replace(/(\d+)\s*(euros?|€)/gi, (_, number) => `${number} €`);
    
    // Formatage pourcentage
    output = output.replace(/(\d+)\s*(pour(?:cents?|centage)?)/gi, (_, number) => `${number} %`);
    
    // Correction ponctuation
    output = output.replace(/\s+([?!:;,.])/g, '$1');

    return output;
  }

  /**
   * Ajouter intelligemment du texte (ex-frontend)
   */
  private smartAppend(previous: string, next: string): string {
    if (!previous) return next;
    if (!next) return previous;
    if (previous.endsWith(next)) return previous;

    const maxOverlap = Math.min(previous.length, next.length, 100);
    for (let k = maxOverlap; k >= 10; k -= 1) {
      const tail = previous.slice(-k);
      if (next.startsWith(tail)) {
        return previous + next.slice(k);
      }
    }
    return previous + (/\s$/.test(previous) ? '' : ' ') + next;
  }

  /**
   * Finaliser une phrase (ex-frontend)
   */
  private finalizeSentence(text: string): string {
    if (!text) return text;
    if (/[.?!…](?:\s|$)/.test(text.slice(-2))) return text;
    return text + '.';
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
   * Nettoyer la sortie de l'IA
   */
  private cleanAIOutput(aiText: string): string {
    return aiText
      // Supprimer les explications en début
      .replace(/^.*?(?=\*\*[^*]+\s*:\*\*)/s, '')
      // Supprimer les commentaires entre crochets
      .replace(/\[.*?\]/g, '')
      // Nettoyer les espaces multiples
      .replace(/\s+/g, ' ')
      .trim();
    
    // Note: Le formatage avec retours à la ligne sera appliqué automatiquement 
    // dans le processus principal après ce nettoyage
  }

  /**
   * Formater un dialogue avec des retours à la ligne entre les interlocuteurs
   */
  private formatDialogueWithLineBreaks(text: string): string {
    if (!text || text.trim().length === 0) return text;

    // Pattern pour détecter les marqueurs de dialogue (ex: **Commercial :** ou **Prospect :**)
    const speakerPattern = /(\*\*[^*]+\s*:\s*\*\*)/g;
    
    // Diviser le texte en utilisant le pattern des interlocuteurs
    const parts = text.split(speakerPattern).filter(part => part.trim().length > 0);
    
    let formattedText = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      // Si c'est un marqueur d'interlocuteur (commence par ** et finit par **)
      if (speakerPattern.test(part)) {
        // Ajouter un retour à la ligne avant chaque nouveau locuteur (sauf le premier)
        if (formattedText.length > 0) {
          formattedText += '\n\n';
        }
        formattedText += part;
      } else {
        // C'est le texte parlé, l'ajouter avec un espace
        formattedText += ' ' + part;
      }
    }
    
    return formattedText.trim();
  }


  /**
   * Traitement en temps réel (pour la transcription live)
   */
  processLiveTranscription(text: string): {
    displayText: string;
    stats: { words: number; chars: number; }
  } {
    const processed = this.basicTextProcessing(text);
    const words = processed.split(/\s+/).filter(w => w.length > 0);
    
    return {
      displayText: processed,
      stats: {
        words: words.length,
        chars: processed.length
      }
    };
  }

  /**
   * Traitement intelligent pour chunks live avec merge
   */
  processLiveChunk(
    chunk: string, 
    committed: string = '', 
    isFinal: boolean = false,
    maxChars: number = 8000
  ): {
    processedChunk: string;
    newCommitted: string;
    shouldFinalize: boolean;
  } {
    // 1. Traitement basique du chunk
    let processedChunk = this.basicTextProcessing(chunk);
    
    // 2. Si c'est final, finaliser la phrase
    if (isFinal) {
      processedChunk = this.finalizeSentence(processedChunk);
    }

    // 3. Merge intelligent avec le texte déjà committed
    let newCommitted = this.smartAppend(committed, processedChunk);
    
    // 4. Limiter la longueur si nécessaire
    if (newCommitted.length > maxChars) {
      newCommitted = newCommitted.slice(newCommitted.length - maxChars);
    }

    return {
      processedChunk,
      newCommitted,
      shouldFinalize: isFinal
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