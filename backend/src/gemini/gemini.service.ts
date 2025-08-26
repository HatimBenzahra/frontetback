import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private localLLMUrl: string;

  constructor() {
    // Utiliser l'URL du LLM local depuis les variables d'environnement
    this.localLLMUrl = process.env.LOCAL_LLM_URL || 'http://192.168.1.120:1234';
    this.logger.log(`🤖 LLM local configuré: ${this.localLLMUrl}`);
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

TRANSCRIPTION À TRAITER :
${transcription}

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
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
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

        // Nettoyage post-traitement pour s'assurer des retours à la ligne
        const cleanedText = this.cleanAndFormatDialogue(restructuredText);

        this.logger.log('Restructuration terminée avec succès');
        return cleanedText;

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

  /**
   * Nettoie et formate le dialogue pour s'assurer des retours à la ligne
   */
  private cleanAndFormatDialogue(text: string): string {
    if (!text) return text;

    // 1. Nettoyer les espaces multiples et retours à la ligne
    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Supprimer les lignes vides multiples
      .trim();

    // 2. FORÇER les retours à la ligne entre interlocuteurs - méthode plus agressive
    // Remplacer tous les patterns **Commercial :** ou **Prospect :** suivis directement d'un autre interlocuteur
    cleaned = cleaned.replace(/(\*\*Commercial\s*:\*\*[^]*?)(\*\*Prospect\s*:\*\*)/g, '$1\n\n$2');
    cleaned = cleaned.replace(/(\*\*Prospect\s*:\*\*[^]*?)(\*\*Commercial\s*:\*\*)/g, '$1\n\n$2');

    // 3. Si le texte ne contient pas de retours à la ligne, les forcer
    if (!cleaned.includes('\n\n')) {
      // Diviser le texte en segments d'interlocuteurs
      const segments = cleaned.split(/(\*\*[^*]+\*\*)/);
      const formattedSegments: string[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (segment.includes('**')) {
          // C'est un marqueur d'interlocuteur
          formattedSegments.push(segment);
        } else if (segment.trim()) {
          // C'est du contenu, l'ajouter
          formattedSegments.push(segment.trim());
        }
      }
      
      // Reconstruire avec des retours à la ligne
      cleaned = '';
      for (let i = 0; i < formattedSegments.length; i += 2) {
        if (i + 1 < formattedSegments.length) {
          cleaned += formattedSegments[i] + ' ' + formattedSegments[i + 1];
        } else {
          cleaned += formattedSegments[i];
        }
        
        // Ajouter un retour à la ligne si ce n'est pas le dernier segment
        if (i + 2 < formattedSegments.length) {
          cleaned += '\n\n';
        }
      }
    }

    // 4. Nettoyer les espaces en début/fin de chaque ligne
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0) // Supprimer les lignes vides
      .join('\n');

    // 5. Ajouter un retour à la ligne entre chaque interlocuteur (méthode finale)
    const lines = cleaned.split('\n');
    const formattedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      
      formattedLines.push(line);
      
      // Si la ligne actuelle contient un interlocuteur et la suivante aussi, ajouter une ligne vide
      if (line.includes('**') && nextLine && nextLine.includes('**')) {
        formattedLines.push('');
      }
    }

    return formattedLines.join('\n');
  }
}