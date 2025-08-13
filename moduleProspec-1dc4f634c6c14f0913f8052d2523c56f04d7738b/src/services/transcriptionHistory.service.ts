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

class TranscriptionHistoryService {
  private baseUrl: string;

  constructor() {
    const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const API_PORT = import.meta.env.VITE_API_PORT || '3000';
    this.baseUrl = `https://${SERVER_HOST}:${API_PORT}`;
  }

  async saveTranscriptionSession(session: TranscriptionSession): Promise<void> {
    try {
      console.log('📚 Sauvegarde session transcription:', session);
      
      const response = await fetch(`${this.baseUrl}/api/transcription-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(session),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      console.log('✅ Session transcription sauvegardée');
    } catch (error) {
      console.error('❌ Erreur sauvegarde session transcription:', error);
      throw error;
    }
  }

  async getTranscriptionHistory(commercialId?: string, limit: number = 50): Promise<TranscriptionSession[]> {
    try {
      const params = new URLSearchParams();
      if (commercialId) {
        params.append('commercial_id', commercialId);
      }
      params.append('limit', limit.toString());

      const response = await fetch(`${this.baseUrl}/api/transcription-history?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data.history || [];
    } catch (error) {
      console.error('❌ Erreur récupération historique transcriptions:', error);
      return [];
    }
  }

  async deleteTranscriptionSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/transcription-history/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      console.log('✅ Session transcription supprimée');
    } catch (error) {
      console.error('❌ Erreur suppression session transcription:', error);
      throw error;
    }
  }

  async patchSessionIfShorter(sessionId: string, fullTranscript: string): Promise<boolean> {
    try {
      console.log('📚 Synchronisation session transcription:', sessionId, 'longueur:', fullTranscript.length);
      
      const response = await fetch(`${this.baseUrl}/api/transcription-history/${sessionId}/sync`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_transcript: fullTranscript }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Synchronisation session transcription:', result);
      
      return result.success && result.updated;
    } catch (error) {
      console.error('❌ Erreur synchronisation session transcription:', error);
      return false;
    }
  }

  async getAllCommercials(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/transcription-history/commercials`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const data = await response.json();
      const list = (data.commercials || []).map((c: any) => ({ id: c.id, name: c.name }));
      return list;
    } catch (error) {
      console.error('❌ Erreur récupération commerciaux (transcriptions):', error);
      return [];
    }
  }
}

export const transcriptionHistoryService = new TranscriptionHistoryService(); 
