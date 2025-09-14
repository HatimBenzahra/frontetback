import { Injectable, Logger } from '@nestjs/common';
import { CentralizedConfig } from '../events/websocket.config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private geminiApiKey: string;

  constructor() {
    // Utiliser la clé API Gemini depuis la configuration centralisée
    this.geminiApiKey = CentralizedConfig.getGeminiApiKey();
    this.logger.log(`API Gemini configurée avec succès`);
  }

  async restructureDialogue(transcription: string): Promise<string> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Début de la restructuration du dialogue avec Gemini API (tentative ${attempt}/${maxRetries})`);
        
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
7. Il faut que la phrase soit cohérente avec le contexte de la conversation
8. OBLIGATOIRE : Un retour à la ligne vide entre chaque interlocuteur

FORMAT STRICT - RESPECTER EXACTEMENT :
**Commercial :** [texte corrigé]

**Prospect :** [texte corrigé]

**Commercial :** [texte corrigé]

RÈGLES DE FORMATAGE OBLIGATOIRES :
- TOUJOURS une ligne vide entre chaque interlocuteur
- JAMAIS de dialogue consécutif sans ligne vide
- Chaque changement d'interlocuteur = nouvelle ligne vide
- FORMAT EXACT À RESPECTER :

**Commercial :** Bonjour, comment allez-vous ?

**Prospect :** Très bien, merci.

**Commercial :** Parfait, je vous propose notre offre.

**Prospect :** Ça m'intéresse.

IMPORTANT : Chaque interlocuteur doit être sur sa propre ligne avec une ligne vide entre eux.

RÉSULTAT (avec retours à la ligne obligatoires) :`;

        // Appel à l'API Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${prompt}\n\nVoici les données à traiter : ${transcription}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2000,
              topP: 0.8,
              topK: 10
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erreur Gemini API: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const restructuredText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!restructuredText) {
          throw new Error('Réponse vide de l\'API Gemini');
        }

        this.logger.log('Restructuration terminée avec succès via Gemini API');
        return restructuredText;

      } catch (error: any) {
        lastError = error;
        
        // Gestion des erreurs réseau et API
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message.includes('fetch')) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.warn(`Erreur de connexion à l'API Gemini, nouvelle tentative dans ${retryDelay}ms (${attempt}/${maxRetries})`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        // Pour les autres erreurs ou après max tentatives
        this.logger.error(`Erreur lors de la restructuration (tentative ${attempt}/${maxRetries}):`, error);
        throw new Error(`Erreur de restructuration Gemini: ${error.message}`);
      }
    }
    
    throw new Error(`Échec après ${maxRetries} tentatives: ${lastError.message}`);
  }
}