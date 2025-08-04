import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAudioStreaming } from '@/hooks/useAudioStreaming';
import { commercialService } from '@/services/commercial.service';
import { transcriptionHistoryService } from '@/services/transcriptionHistory.service';
import { useAuth } from '@/contexts/AuthContext';
import { TranscriptionProcessor } from '@/utils/transcriptionProcessor';
import { toast } from 'sonner';
import { PYTHON_SERVER_URL } from '@/config';
import type { 
  CommercialGPS, 
  Zone, 
  TranscriptionSession, 
  AudioStreamingState 
} from '@/types/types';

export const useSuiviLogic = () => {
  const { user } = useAuth();
  const [commercials, setCommercials] = useState<CommercialGPS[]>([]);
  const [selectedCommercial, setSelectedCommercial] = useState<CommercialGPS | null>(null);
  const [zones] = useState<Zone[]>([]);
  const [, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showListeningModal, setShowListeningModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [attemptedListeningTo, setAttemptedListeningTo] = useState<string | null>(null);
  
  // Stocker les transcriptions par commercial
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  const transcriptionProcessorsRef = useRef<Record<string, TranscriptionProcessor>>({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedCommercialForHistory, setSelectedCommercialForHistory] = useState<CommercialGPS | null>(null);
  const [selectedSession, setSelectedSession] = useState<TranscriptionSession | null>(null);

  // Configuration du streaming audio
  const audioServerUrl = PYTHON_SERVER_URL;
  const audioStreaming = useAudioStreaming({
    serverUrl: audioServerUrl,
    userId: user?.id || '',
    userRole: 'admin',
    userInfo: {
      name: user?.nom || '',
      role: user?.role || 'admin'
    }
  });

  // Initialiser Socket.IO pour recevoir les mises à jour GPS
  useEffect(() => {
    const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const API_PORT = import.meta.env.VITE_API_PORT || '3000';
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    
    const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');
    const socketUrl = isDevelopment ? `${protocol}://${SERVER_HOST}:${API_PORT}` : `${protocol}://${SERVER_HOST}`;
    
    const socketConnection = io(socketUrl, {
      secure: protocol === 'https',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      rejectUnauthorized: false,
    });

    socketConnection.on('connect', () => {
      console.log('✅ Socket connecté pour suivi GPS');
      socketConnection.emit('joinRoom', 'gps-tracking');
      socketConnection.emit('joinRoom', 'audio-streaming');
      socketConnection.emit('request_streaming_status');
    });

    socketConnection.on('locationUpdate', (data: {
      commercialId: string;
      position: [number, number];
      timestamp: string;
      speed?: number;
      heading?: number;
    }) => {
      setCommercials(prev => {
        const updated = prev.map(commercial => 
          commercial.id === data.commercialId 
            ? {
                ...commercial,
                position: data.position,
                lastUpdate: new Date(data.timestamp),
                speed: data.speed,
                heading: data.heading,
                isOnline: true
              }
            : commercial
        );
        return updated;
      });
    });

    socketConnection.on('commercialOffline', (commercialId: string) => {
      setCommercials(prev => prev.map(commercial => 
        commercial.id === commercialId 
          ? { ...commercial, isOnline: false }
          : commercial
      ));
    });

    socketConnection.on('start_streaming', (data: { commercial_id: string; commercial_info: any }) => {
      setCommercials(prev => prev.map(commercial => 
        commercial.id === data.commercial_id 
          ? { ...commercial, isStreaming: true }
          : commercial
      ));
      
      setTranscriptions(prev => ({ ...prev, [data.commercial_id]: '' }));
      transcriptionProcessorsRef.current[data.commercial_id] = new TranscriptionProcessor();
    });

    socketConnection.on('stop_streaming', (data: { commercial_id: string }) => {
      setCommercials(prev => prev.map(commercial => 
        commercial.id === data.commercial_id 
          ? { ...commercial, isStreaming: false }
          : commercial
      ));
      
      setTranscriptions(prev => ({ ...prev, [data.commercial_id]: '' }));
      
      if (transcriptionProcessorsRef.current[data.commercial_id]) {
        delete transcriptionProcessorsRef.current[data.commercial_id];
      }
    });

    socketConnection.on('streaming_status_response', (data: { active_streams: Array<{ commercial_id: string; commercial_info: any }> }) => {
      setCommercials(prev => {
        const updated = prev.map(commercial => {
          const isCurrentlyStreaming = data.active_streams.some(stream => stream.commercial_id === commercial.id);
          return { ...commercial, isStreaming: isCurrentlyStreaming };
        });
        return updated;
      });
    });

    socketConnection.on('transcription_session_completed', (session: TranscriptionSession) => {
      setTranscriptionHistory(prev => [session, ...prev]);
    });

    socketConnection.on('transcription_history_response', (data: { history: TranscriptionSession[] }) => {
      setTranscriptionHistory(data.history);
      setLoadingHistory(false);
    });

    socketConnection.on('transcription_update', (data: { 
      commercial_id: string; 
      transcript: string; 
      is_final: boolean; 
      timestamp: string 
    }) => {
      const processor = transcriptionProcessorsRef.current[data.commercial_id] || new TranscriptionProcessor();
      transcriptionProcessorsRef.current[data.commercial_id] = processor;
      const formattedText = processor.addSegment(data.transcript, data.is_final);
      
      setTranscriptions(transcriptions => ({
        ...transcriptions,
        [data.commercial_id]: formattedText
      }));
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  // Charger les commerciaux au démarrage
  useEffect(() => {
    const loadCommercials = async () => {
      try {
        const response = await commercialService.getCommerciaux();
        const commercialsData = response.map((c: any) => ({
          id: c.id,
          name: c.nom,
          avatarFallback: c.nom.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
          position: null,
          equipe: c.equipe?.nom || 'Aucune équipe',
          isOnline: false,
          isStreaming: false,
          lastUpdate: null,
        }));
        setCommercials(commercialsData);
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors du chargement des commerciaux:', error);
        setLoading(false);
      }
    };

    loadCommercials();
  }, []);

  // Connecter au serveur de streaming audio
  useEffect(() => {
    if (user?.id) {
      audioStreaming.connect();
    }
    
    return () => {
      audioStreaming.disconnect();
    };
  }, [user?.id]);

  // Vérifier périodiquement les statuts en ligne/hors ligne
  useEffect(() => {
    const checkOnlineStatus = () => {
      setCommercials(prev => prev.map(commercial => {
        if (!commercial.lastUpdate) {
          return commercial;
        }
        
        const timeSinceLastUpdate = new Date().getTime() - commercial.lastUpdate.getTime();
        const shouldBeOffline = timeSinceLastUpdate > 2 * 60 * 1000;
        
        if (commercial.isOnline && shouldBeOffline) {
          return { ...commercial, isOnline: false };
        }
        return commercial;
      }));
    };

    const interval = setInterval(checkOnlineStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleShowOnMap = (commercial: CommercialGPS) => {
    setSelectedCommercial(commercial);
    setShowMapModal(true);
  };

  const handleShowHistory = async (commercial: CommercialGPS) => {
    setSelectedCommercialForHistory(commercial);
    setSelectedSession(null);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    
    try {
      const history = await transcriptionHistoryService.getTranscriptionHistory(commercial.id);
      setTranscriptionHistory(history);
    } catch (error) {
      console.error('❌ Erreur récupération historique:', error);
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartListening = async (commercialId: string) => {
    const commercial = commercials.find(c => c.id === commercialId);
    
    if (!commercial?.isStreaming) {
      toast.error("Ce commercial n'est pas en streaming actuellement");
      return;
    }
    
    try {
      setAttemptedListeningTo(commercialId);
      await audioStreaming.startListening(commercialId);
      setShowListeningModal(true);
    } catch (error) {
      console.error('❌ ADMIN - Erreur démarrage écoute:', error);
      setAttemptedListeningTo(null);
      toast.error("Erreur lors du démarrage de l'écoute");
    }
  };

  const handleStopListening = async () => {
    try {
      const currentCommercialId = audioStreaming.currentListeningTo || attemptedListeningTo;
      
      await audioStreaming.stopListening();
      setAttemptedListeningTo(null);
      
      if (currentCommercialId) {
        setTranscriptions(prev => ({ ...prev, [currentCommercialId]: '' }));
      }
    } catch (error) {
      console.error('❌ ADMIN - Erreur lors de l\'arrêt de l\'écoute:', error);
      setAttemptedListeningTo(null);
    }
  };

  return {
    // State
    commercials,
    selectedCommercial,
    zones,
    loading,
    showListeningModal,
    showMapModal,
    showHistoryModal,
    attemptedListeningTo,
    transcriptions,
    transcriptionHistory,
    loadingHistory,
    selectedCommercialForHistory,
    selectedSession,
    audioStreaming,

    // Actions
    handleShowOnMap,
    handleShowHistory,
    handleStartListening,
    handleStopListening,
    setShowListeningModal,
    setShowMapModal,
    setShowHistoryModal,
    setSelectedCommercial,
    setSelectedCommercialForHistory,
    setSelectedSession,
    setAttemptedListeningTo,
  };
}; 