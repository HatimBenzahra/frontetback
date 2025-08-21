import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor() {
    // Utiliser la clé API fournie
    this.genAI = new GoogleGenerativeAI('AIzaSyBg0L2VNRFAWcCnc1pj_tndLiaDrBQXm6I');
  }

  async restructureDialogue(transcription: string): Promise<string> {
    try {
      this.logger.log('🤖 Début de la restructuration du dialogue avec Gemini');
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
Tu es un expert en restructuration de transcriptions commerciales.
Ta mission : identifier les interlocuteurs et corriger le texte, SANS EXPLICATION.

RÈGLES D'IDENTIFICATION AUTOMATIQUE :
• COMMERCIAL : vocabulaire professionnel ("je vous propose", "notre offre", "je vous envoie", "confirmation", "comme convenu", "parfait")
• PROSPECT/CLIENT : réactions ("ça m'intéresse", "je réfléchis", "d'accord", questions sur le produit)
• Si incertain, la personne qui structure/présente = COMMERCIAL

INSTRUCTIONS :
1. Identifie automatiquement qui parle
2. Corrige les erreurs de transcription 
3. Complète les phrases incomplètes
4. Supprime les hésitations (euh, hmm)
5. Améliore la ponctuation
6. AUCUN commentaire ni explication

FORMAT STRICT :
**Commercial :** [texte corrigé]
**Prospect :** [texte corrigé]

TRANSCRIPTION À TRAITER :
${transcription}

RÉSULTAT :`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const restructuredText = response.text();

      this.logger.log('✅ Restructuration terminée avec succès');
      return restructuredText;

    } catch (error) {
      this.logger.error('❌ Erreur lors de la restructuration:', error);
      throw new Error(`Erreur de restructuration: ${error.message}`);
    }
  }

  async enhanceTranscription(transcription: string, context?: string): Promise<string> {
    try {
      this.logger.log('✨ Amélioration de la transcription avec contexte');
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const contextPrompt = context ? `CONTEXTE : ${context}\n\n` : '';

      const prompt = `
Tu es un expert en amélioration de transcriptions commerciales.
Ta mission est d'améliorer la qualité d'une transcription tout en préservant son authenticité.

${contextPrompt}TÂCHES :
1. Corriger les erreurs de transcription automatique
2. Améliorer la ponctuation et la grammaire
3. Structurer les phrases de manière claire
4. Préserver le ton et le style de chaque interlocuteur
5. Maintenir tous les détails importants de la conversation

TRANSCRIPTION ORIGINALE :
${transcription}

TRANSCRIPTION AMÉLIORÉE :`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const enhancedText = response.text();

      this.logger.log('✅ Amélioration terminée avec succès');
      return enhancedText;

    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'amélioration:', error);
      throw new Error(`Erreur d'amélioration: ${error.message}`);
    }
  }

  async generateSummary(transcription: string): Promise<string> {
    try {
      this.logger.log('📝 Génération du résumé de conversation');
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `
Génère un résumé professionnel de cette conversation commerciale.

STRUCTURE DU RÉSUMÉ :
## Points clés abordés
- [Point 1]
- [Point 2]

## Intérêts du prospect
- [Intérêt 1]
- [Intérêt 2]

## Actions à retenir
- [Action 1]
- [Action 2]

## Prochaines étapes suggérées
- [Étape 1]
- [Étape 2]

CONVERSATION :
${transcription}

RÉSUMÉ :`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      this.logger.log('✅ Résumé généré avec succès');
      return summary;

    } catch (error) {
      this.logger.error('❌ Erreur lors de la génération du résumé:', error);
      throw new Error(`Erreur de génération de résumé: ${error.message}`);
    }
  }
}