import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private localLLMUrl: string;

  constructor() {
    // Utiliser l'URL du LLM local depuis les variables d'environnement
    this.localLLMUrl = process.env.LOCAL_LLM_URL || 'http://192.168.1.120:1234';
    this.logger.log(`LLM local configuré: ${this.localLLMUrl}`);
  }

  async restructureDialogue(transcription: string): Promise<string> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Début de la restructuration du dialogue avec LLM local (tentative ${attempt}/${maxRetries})`);
        
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

        // Appel à l'API locale
        const response = await fetch(`${this.localLLMUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'qwen/qwen3-4b-2507', // modèle local détecté
            messages: [
              {
                role: 'system',
                content: prompt
              },
              {
                role: 'user',
                content: 'Voici les données à traiter : ' + transcription
              }
            ],
            temperature: 0.3,
            max_tokens: 2000
          })
        });

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const restructuredText = data.choices[0]?.message?.content;

        if (!restructuredText) {
          throw new Error('Réponse vide du LLM local');
        }

        this.logger.log('Restructuration terminée avec succès');
        return restructuredText;

      } catch (error: any) {
        lastError = error;
        
        // Gestion des erreurs réseau
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.warn(`Erreur de connexion au LLM local, nouvelle tentative dans ${retryDelay}ms (${attempt}/${maxRetries})`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        // Pour les autres erreurs ou après max tentatives
        this.logger.error(`Erreur lors de la restructuration (tentative ${attempt}/${maxRetries}):`, error);
        throw new Error(`Erreur de restructuration: ${error.message}`);
      }
    }
    
    throw new Error(`Échec après ${maxRetries} tentatives: ${lastError.message}`);
  }
}