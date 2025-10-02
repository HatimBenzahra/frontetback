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
Tu es un correcteur de transcriptions commerciales. Ta mission UNIQUE : corriger et améliorer le texte existant SANS AJOUTER de contenu.

RÈGLES STRICTES - À RESPECTER ABSOLUMENT :
1. NE PAS INVENTER de nouvelles phrases
2. NE PAS AJOUTER d'informations non présentes dans le texte original
3. NE PAS COMPLÉTER les phrases avec du contenu fictif
4. SEULEMENT corriger les erreurs de transcription évidentes
5. SEULEMENT deviner les mots manquants quand le contexte le permet clairement
6. SEULEMENT améliorer la ponctuation et la structure des phrases existantes

IDENTIFICATION DES INTERLOCUTEURS :
• COMMERCIAL : vocabulaire professionnel ("je vous propose", "notre offre", "je vous envoie", "confirmation", "comme convenu", "parfait")
• PROSPECT/CLIENT : réactions ("ça m'intéresse", "je réfléchis", "d'accord", questions sur le produit)
• Si incertain, la personne qui structure/présente = COMMERCIAL

CORRECTIONS AUTORISÉES UNIQUEMENT :
- Corriger les mots mal transcrits (ex: "bonjour" au lieu de "bonzour")
- Compléter les mots évidents (ex: "téléph" → "téléphone")
- Supprimer les hésitations (euh, hmm, etc.)
- Améliorer la ponctuation
- Structurer les phrases pour qu'elles aient du sens
- Corriger les répétitions évidentes

INTERDICTIONS ABSOLUES :
- Ajouter des phrases entières
- Inventer des réponses
- Compléter avec du contenu fictif
- Ajouter des détails non mentionnés
- Créer des dialogues qui n'existent pas dans l'original

FORMAT STRICT - RESPECTER EXACTEMENT :
**Commercial :** [texte corrigé uniquement]

**Prospect :** [texte corrigé uniquement]

**Commercial :** [texte corrigé uniquement]

RÈGLES DE FORMATAGE OBLIGATOIRES :
- TOUJOURS une ligne vide entre chaque interlocuteur
- Chaque changement d'interlocuteur = nouvelle ligne vide
- FORMAT EXACT À RESPECTER : **Interlocuteur :** [texte original corrigé]

IMPORTANT : 
- Reste fidèle au contenu original
- Ne transforme pas le sens des phrases
- Ne complète que ce qui est évident dans le contexte
- Chaque interlocuteur doit être sur sa propre ligne avec une ligne vide entre eux

RÉSULTAT (avec retours à la ligne obligatoires) :`;

        // Appel à l'API Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`, {
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
              temperature: 0.1, // Plus bas pour être plus conservateur
              maxOutputTokens: 1500, // Limiter la longueur pour éviter l'ajout de contenu
              topP: 0.6, // Plus bas pour réduire la créativité
              topK: 5 // Plus bas pour être plus prévisible
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