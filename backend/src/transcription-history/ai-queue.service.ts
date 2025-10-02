import { Injectable, Logger } from '@nestjs/common';

interface QueueItem {
  sessionId: string;
  text: string;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  addedAt: number;
}

/**
 * Service de queue pour gérer le rate limiting des appels IA
 * Limite : 1 requête par seconde (60/min) pour éviter les rate limits Gemini
 */
@Injectable()
export class AIQueueService {
  private readonly logger = new Logger(AIQueueService.name);
  private queue: QueueItem[] = [];
  private processing = false;
  private processingCount = 0;
  private readonly RATE_LIMIT_DELAY = 1000; // 1 seconde entre chaque requête
  private readonly MAX_RETRIES = 3;
  private lastProcessTime = 0;

  constructor() {
    this.logger.log('🔄 AI Queue Service initialisé avec rate limiting (1 req/sec)');
  }

  /**
   * Ajoute une tâche à la queue
   */
  async enqueue(sessionId: string, text: string, processor: (text: string) => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        sessionId,
        text,
        resolve,
        reject,
        addedAt: Date.now()
      };

      this.queue.push(item);
      this.logger.log(`📥 Session ${sessionId} ajoutée à la queue IA (position: ${this.queue.length})`);

      // Démarrer le traitement si pas déjà en cours
      if (!this.processing) {
        this.processQueue(processor);
      }
    });
  }

  /**
   * Traite la queue avec rate limiting
   */
  private async processQueue(processor: (text: string) => Promise<any>) {
    if (this.processing) return;
    
    this.processing = true;
    this.logger.log(`🚀 Démarrage du traitement de la queue (${this.queue.length} éléments)`);

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      const waitTime = Date.now() - item.addedAt;

      try {
        // Rate limiting : attendre 1 seconde depuis la dernière requête
        const timeSinceLastProcess = Date.now() - this.lastProcessTime;
        if (timeSinceLastProcess < this.RATE_LIMIT_DELAY) {
          const delay = this.RATE_LIMIT_DELAY - timeSinceLastProcess;
          this.logger.log(`⏱️  Rate limiting: attente de ${delay}ms avant traitement`);
          await this.sleep(delay);
        }

        this.processingCount++;
        this.logger.log(`🤖 Traitement IA session ${item.sessionId} (attendu ${waitTime}ms, restant: ${this.queue.length})`);

        // Traiter avec le processeur fourni
        const result = await this.retryWithBackoff(() => processor(item.text), item.sessionId);
        
        this.lastProcessTime = Date.now();
        item.resolve(result);

        this.logger.log(`✅ Session ${item.sessionId} traitée avec succès (total: ${this.processingCount})`);

      } catch (error) {
        this.logger.error(`❌ Erreur traitement session ${item.sessionId}:`, error);
        item.reject(error);
      }
    }

    this.processing = false;
    this.logger.log(`✅ Queue IA vidée (${this.processingCount} sessions traitées au total)`);
  }

  /**
   * Retry avec backoff exponentiel
   */
  private async retryWithBackoff(
    fn: () => Promise<any>, 
    sessionId: string
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Si c'est un rate limit error, attendre plus longtemps
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // Max 10s
          this.logger.warn(`⚠️  Rate limit atteint pour session ${sessionId}, retry dans ${delay}ms (${attempt}/${this.MAX_RETRIES})`);
          await this.sleep(delay);
          continue;
        }

        // Pour les autres erreurs, backoff classique
        if (attempt < this.MAX_RETRIES) {
          const delay = 1000 * attempt;
          this.logger.warn(`⚠️  Erreur session ${sessionId}, retry dans ${delay}ms (${attempt}/${this.MAX_RETRIES})`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper pour sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Statistiques de la queue
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      totalProcessed: this.processingCount,
      lastProcessTime: this.lastProcessTime
    };
  }
}

