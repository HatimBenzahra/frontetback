import  { useState, useEffect, useRef } from 'react';
import { Card, CardContent  } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Badge } from '@/components/ui-admin/badge';
import { Modal } from '@/components/ui-admin/Modal';
import { Slider } from '@/components/ui-admin/slider';
import { useAudioStreaming } from '@/hooks/useAudioStreaming';
import { commercialService } from '@/services/commercial.service';
import { transcriptionHistoryService, type TranscriptionSession } from '@/services/transcriptionHistory.service';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { TranscriptionProcessor } from '@/utils/transcriptionProcessor';
import { toast } from 'sonner';
import { 
  Users, 
  Headphones, 
  VolumeX, 
  Volume2, 
  FileText,
  History,
  Calendar,
  Clock,
  Building
} from 'lucide-react';
import { SuiviMap } from './SuiviMap';
import { createColumns } from './suivi-table/columns';
import { DataTable } from '@/components/data-table/DataTable';

interface CommercialGPS {
  id: string;
  name: string;
  avatarFallback: string;
  position: [number, number] | null;
  equipe: string;
  isOnline: boolean;
  isStreaming: boolean;
  lastUpdate: Date | null;
  speed?: number;
  heading?: number;
}



interface Zone {
  id: string;
  name: string;
  coordinates: [number, number][];
  color: string;
  latlng: [number, number];
  radius: number;
}

const SuiviPage = () => {
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
  const transcriptionRef = useRef<HTMLDivElement>(null);

  // Configuration du streaming audio - détection automatique du protocole
  const getAudioServerUrl = () => {
    const isHttps = window.location.protocol === 'https:';
    const hostname = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const httpsPort = import.meta.env.VITE_PYTHON_HTTPS_PORT || '8443';
    const httpPort = import.meta.env.VITE_PYTHON_HTTP_PORT || '8080';
    
    // Use different URLs for development vs production
    const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
    
    if (isDevelopment) {
      // Development: connect directly to python server
      if (isHttps) {
        console.log('🔧 Utilisation HTTPS pour le serveur audio (page en HTTPS)');
        return `https://${hostname}:${httpsPort}`;
      } else {
        console.log('🔧 Utilisation HTTP pour le serveur audio (page en HTTP)');
        return `http://${hostname}:${httpPort}`;
      }
    } else {
      // Production: use nginx proxy
      const protocol = isHttps ? 'https' : 'http';
      console.log('🔧 Utilisation proxy nginx pour le serveur audio');
      return `${protocol}://${hostname}/python`;
    }
  };

  const audioServerUrl = getAudioServerUrl();
  console.log('🎧 ADMIN PAGE - Configuration audio streaming:');
  console.log('🎧 ADMIN PAGE - Server URL:', audioServerUrl);
  console.log('🎧 ADMIN PAGE - User ID:', user?.id);
  console.log('🎧 ADMIN PAGE - User role: admin');

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
    
    // Use different URLs for development vs production
    const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');
    const socketUrl = isDevelopment ? `${protocol}://${SERVER_HOST}:${API_PORT}` : `${protocol}://${SERVER_HOST}`;
    console.log('🔌 Connexion socket admin GPS:', socketUrl);
    
    const socketConnection = io(socketUrl, {
      secure: protocol === 'https',
      transports: ['polling', 'websocket'], // Polling en premier pour mobile
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      rejectUnauthorized: false, // Accepter les certificats auto-signés
    });

    socketConnection.on('connect', () => {
      console.log('✅ Socket connecté pour suivi GPS');
      socketConnection.emit('joinRoom', 'gps-tracking');
      
      // Aussi rejoindre la room pour les événements audio
      socketConnection.emit('joinRoom', 'audio-streaming');
      console.log('✅ Rejoint la room audio-streaming');
      
      // Demander l'état actuel des streams pour synchroniser
      socketConnection.emit('request_streaming_status');
      console.log('🔄 Demande de synchronisation des streams actifs');
    });

    socketConnection.on('locationUpdate', (data: {
      commercialId: string;
      position: [number, number];
      timestamp: string;
      speed?: number;
      heading?: number;
    }) => {
      console.log('📍 Position reçue côté admin:', data);
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
        console.log('📊 Commerciaux mis à jour:', updated);
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

    // DEBUG: Écouter tous les événements
    socketConnection.onAny((eventName, ...args) => {
      if (eventName.includes('stream')) {
        console.log('🔍 ADMIN - Événement reçu:', eventName, args);
      }
    });

    // Écouter les événements de streaming audio
    socketConnection.on('start_streaming', (data: { commercial_id: string; commercial_info: any }) => {
      console.log('🎤 ADMIN - Commercial started streaming:', data);
      setCommercials(prev => prev.map(commercial => 
        commercial.id === data.commercial_id 
          ? { ...commercial, isStreaming: true }
          : commercial
      ));
      
      // Réinitialiser complètement la transcription pour ce commercial (nouveau cycle)
      console.log('🔄 ADMIN - Réinitialisation transcription pour nouveau cycle:', data.commercial_id);
      setTranscriptions(prev => ({ ...prev, [data.commercial_id]: '' }));
      transcriptionProcessorsRef.current[data.commercial_id] = new TranscriptionProcessor();
    });

    socketConnection.on('stop_streaming', (data: { commercial_id: string }) => {
      console.log('🎤 ADMIN - Commercial stopped streaming:', data);
      setCommercials(prev => prev.map(commercial => 
        commercial.id === data.commercial_id 
          ? { ...commercial, isStreaming: false }
          : commercial
      ));
      
      // Réinitialiser la transcription en direct pour ce commercial (fin de cycle)
      console.log('🔄 ADMIN - Nettoyage transcription après arrêt streaming:', data.commercial_id);
      setTranscriptions(prev => ({ ...prev, [data.commercial_id]: '' }));
      
      // Nettoyer le processeur de transcription pour ce commercial
      if (transcriptionProcessorsRef.current[data.commercial_id]) {
        delete transcriptionProcessorsRef.current[data.commercial_id];
      }
    });

    // Synchronisation de l'état actuel des streams
    socketConnection.on('streaming_status_response', (data: { active_streams: Array<{ commercial_id: string; commercial_info: any }> }) => {
      console.log('🔄 ADMIN - État actuel des streams reçu:', data);
      
      setCommercials(prev => {
        const updated = prev.map(commercial => {
          const isCurrentlyStreaming = data.active_streams.some(stream => stream.commercial_id === commercial.id);
          console.log(`🔄 ADMIN - Commercial ${commercial.name} (${commercial.id}) streaming: ${commercial.isStreaming} -> ${isCurrentlyStreaming}`);
          return { ...commercial, isStreaming: isCurrentlyStreaming };
        });
        console.log('🔄 ADMIN - États commerciaux mis à jour:', updated.map(c => ({ name: c.name, streaming: c.isStreaming })));
        return updated;
      });
    });

    // Écouter les sessions de transcription terminées
    socketConnection.on('transcription_session_completed', (session: TranscriptionSession) => {
      console.log('📚 ADMIN - Session de transcription terminée:', session);
      setTranscriptionHistory(prev => [session, ...prev]);
    });

    // Écouter la réponse de l'historique des transcriptions
    socketConnection.on('transcription_history_response', (data: { history: TranscriptionSession[] }) => {
      console.log('📚 ADMIN - Historique des transcriptions reçu:', data.history.length, 'sessions');
      setTranscriptionHistory(data.history);
      setLoadingHistory(false);
    });

    // Écouter les mises à jour de transcription
    socketConnection.on('transcription_update', (data: { 
      commercial_id: string; 
      transcript: string; 
      is_final: boolean; 
      timestamp: string 
    }) => {
      console.log('📝 ADMIN - Transcription reçue:', data);
      console.log('📝 ADMIN - Commercial ID:', data.commercial_id);
      console.log('📝 ADMIN - Transcript:', data.transcript);
      console.log('📝 ADMIN - Is final:', data.is_final);
      
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
          position: null, // Pas de position tant qu'il n'a pas envoyé de GPS
          equipe: c.equipe?.nom || 'Aucune équipe',
          isOnline: false, // Sera mis à jour via Socket.IO
          isStreaming: false, // Sera mis à jour via Socket.IO
          lastUpdate: null, // Pas de lastUpdate tant qu'il n'a pas envoyé de GPS
        }));
        console.log('👥 Commerciaux chargés avec données réelles:', commercialsData);
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
    console.log('🎧 ADMIN - useEffect connexion audio, user:', user?.id);
    if (user?.id) {
      console.log('🎧 ADMIN - Tentative de connexion au serveur audio...');
      audioStreaming.connect();
    }
    
    return () => {
      console.log('🎧 ADMIN - Déconnexion du serveur audio');
      audioStreaming.disconnect();
    };
  }, [user?.id]);

  // Demander l'historique quand le modal s'ouvre
  useEffect(() => {
    if (showHistoryModal) {
      // Utiliser le socket de la connexion audio pour envoyer la demande
      console.log('📚 ADMIN - Demande d\'historique envoyée');
      // La demande sera envoyée via le socket de la connexion audio
      // Nous devons accéder au socket via audioStreaming
    }
  }, [showHistoryModal]);

  // Auto-scroll vers le bas quand la transcription se met à jour
  useEffect(() => {
    if (transcriptionRef.current && showListeningModal) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight;
    }
  }, [transcriptions, showListeningModal]);

  // Sélectionner automatiquement la première session quand l'historique change
  useEffect(() => {
    if (transcriptionHistory.length > 0 && !selectedSession) {
      setSelectedSession(transcriptionHistory[0]);
    }
  }, [transcriptionHistory, selectedSession]);


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


  // Vérifier périodiquement les statuts en ligne/hors ligne
  useEffect(() => {
    const checkOnlineStatus = () => {
      setCommercials(prev => prev.map(commercial => {
        // Si jamais de lastUpdate, le commercial n'a jamais été connecté
        if (!commercial.lastUpdate) {
          return commercial;
        }
        
        const timeSinceLastUpdate = new Date().getTime() - commercial.lastUpdate.getTime();
        // Un commercial est considéré hors ligne s'il n'a pas envoyé de position depuis plus de 2 minutes
        const shouldBeOffline = timeSinceLastUpdate > 2 * 60 * 1000;
        
        // Seulement marquer comme hors ligne, pas en ligne (ça vient via Socket.IO)
        if (commercial.isOnline && shouldBeOffline) {
          console.log(`📱 ${commercial.name}: HORS LIGNE (dernière MAJ: ${Math.floor(timeSinceLastUpdate / 1000)}s)`);
          return { ...commercial, isOnline: false };
        }
        return commercial;
      }));
    };

    // Vérifier toutes les 30 secondes
    const interval = setInterval(checkOnlineStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleStartListening = async (commercialId: string) => {
    console.log('🎧 ADMIN - Démarrage écoute pour commercial ID:', commercialId);
    console.log('🎧 ADMIN - État connexion audio:', audioStreaming.isConnected);
    console.log('🎧 ADMIN - Erreur audio:', audioStreaming.error);
    
    // Vérifier si ce commercial est actuellement en streaming
    const commercial = commercials.find(c => c.id === commercialId);
    console.log('🎧 ADMIN - Commercial trouvé:', {
      found: !!commercial,
      isStreaming: commercial?.isStreaming,
      name: commercial?.name
    });
    
    if (!commercial?.isStreaming) {
      console.warn('⚠️ ADMIN - Commercial pas en streaming, arrêt tentative écoute');
      toast.error("Ce commercial n'est pas en streaming actuellement");
      return;
    }
    
    try {
      setAttemptedListeningTo(commercialId);
      await audioStreaming.startListening(commercialId);
      setShowListeningModal(true);
      console.log('✅ ADMIN - Écoute démarrée avec succès');
    } catch (error) {
      console.error('❌ ADMIN - Erreur démarrage écoute:', error);
      setAttemptedListeningTo(null);
      toast.error("Erreur lors du démarrage de l'écoute");
    }
  };

  const handleStopListening = async () => {
    try {
      console.log('🔇 ADMIN - Arrêt de l\'écoute...');
      
      // Capturer l'ID du commercial avant d'arrêter l'écoute
      const currentCommercialId = audioStreaming.currentListeningTo || attemptedListeningTo;
      
      await audioStreaming.stopListening();
      setAttemptedListeningTo(null);
      
      // Réinitialiser la transcription affichée dans le modal d'écoute
      if (currentCommercialId) {
        console.log('🔄 ADMIN - Réinitialisation transcription modal pour:', currentCommercialId);
        setTranscriptions(prev => ({ ...prev, [currentCommercialId]: '' }));
      }
      
      console.log('✅ ADMIN - Écoute arrêtée avec succès');
    } catch (error) {
      console.error('❌ ADMIN - Erreur lors de l\'arrêt de l\'écoute:', error);
      setAttemptedListeningTo(null);
    }
  };


  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fonction pour formater le texte de transcription (utilise maintenant TranscriptionProcessor)
  const formatTranscriptionText = (text: string) => {
    if (!text || text === 'En attente de transcription...') {
      return text;
    }
    return text; // Le texte est déjà formaté par TranscriptionProcessor
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du suivi GPS...</p>
        </div>
      </div>
    );
  }

  const renderMapModal = () => {
    if (!showMapModal || !selectedCommercial) {
      return null;
    }

    return (
      <Modal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        title={`Position de ${selectedCommercial.name}`}
        maxWidth="max-w-4xl"
      >
        <div className="h-[500px]">
          <SuiviMap 
            zones={zones}
            commercials={commercials}
            onMarkerClick={() => {}}
            selectedCommercialId={selectedCommercial.id}
          />
        </div>
      </Modal>
    );
  };

  const renderListeningModal = () => {
    if (!showListeningModal) {
      return null;
    }

    const listeningCommercial = commercials.find(c => c.id === (audioStreaming.currentListeningTo || attemptedListeningTo));
    
    if (!listeningCommercial) {
      return null;
    }

    const currentTranscription = listeningCommercial && transcriptions[listeningCommercial.id] 
      ? formatTranscriptionText(transcriptions[listeningCommercial.id]) 
      : "En attente de transcription...";

    return (
      <Modal
        isOpen={showListeningModal}
        onClose={() => {
          handleStopListening();
          setShowListeningModal(false);
          setAttemptedListeningTo(null);
        }}
        title=""
        maxWidth="max-w-7xl"
      >
        <div className="flex h-[80vh]">
          {/* Section gauche - Contrôles d'écoute */}
          <div className="w-1/3 bg-gradient-to-br from-blue-50 to-indigo-50 border-r border-gray-200 flex flex-col">
            {/* Header commercial */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {listeningCommercial?.avatarFallback}
                  </div>
                  <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-4 border-white shadow-lg ${
                    listeningCommercial?.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{listeningCommercial?.name}</h2>
                  <p className="text-gray-600 text-sm">{listeningCommercial?.equipe}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${listeningCommercial?.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium">
                      {listeningCommercial?.isStreaming ? 'En direct' : 'Hors ligne'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contrôles audio */}
            <div className="p-6 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Headphones className="w-5 h-5 text-blue-600" />
                Contrôles audio
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Volume</span>
                    <span className="text-sm font-bold text-blue-600">{Math.round(audioStreaming.audioVolume * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Connexion audio</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${audioStreaming.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm font-bold ${audioStreaming.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {audioStreaming.isConnected ? 'Connecté' : 'Déconnecté'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX className="h-4 w-4 text-gray-500" />
                    <Slider
                      value={[audioStreaming.audioVolume * 100]}
                      onValueChange={(value) => audioStreaming.setVolume(value[0] / 100)}
                      max={100}
                      min={0}
                      step={1}
                      className="flex-1 [&>span:first-child]:bg-gray-200 [&>span:first-child>span]:bg-blue-600 [&>span:last-child]:bg-blue-600"
                    />
                    <Volume2 className="h-4 w-4 text-gray-500" />
                  </div>
                </div>

                {audioStreaming.error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-red-700 font-medium">Erreur audio détectée</span>
                  </div>
                )}
              </div>
            </div>

            {/* Statistiques */}
            <div className="p-6 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Statistiques
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Caractères</span>
                  <span className="font-semibold text-gray-800">{currentTranscription.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Mots</span>
                  <span className="font-semibold text-gray-800">{currentTranscription.split(/\s+/).filter(word => word.length > 0).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Dernière MAJ</span>
                  <span className="font-semibold text-gray-800">{new Date().toLocaleTimeString('fr-FR')}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-white flex-1 flex flex-col justify-end">
              <div className="space-y-3">
                
                
                <Button
                  variant="outline"
                  onClick={() => {
                    handleStopListening();
                    setShowListeningModal(false);
                    setAttemptedListeningTo(null);
                  }}
                  className="w-full bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>

          {/* Section droite - Transcription */}
          <div className="w-2/3 bg-white flex flex-col">
            {/* Header transcription */}
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Transcription en temps réel</h3>
                    <p className="text-sm text-gray-600">Suivi automatique de la conversation</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-blue-700">Live</span>
                </div>
              </div>
            </div>

            {/* Zone de transcription */}
            <div className="flex-1 p-6 overflow-hidden">
              <div ref={transcriptionRef} className="h-full bg-gray-50 rounded-lg border border-gray-200 p-6 overflow-y-auto">
                {currentTranscription === "En attente de transcription..." ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-10 h-10 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">En attente de transcription</h3>
                      <p className="text-gray-500">La transcription apparaîtra ici dès que le commercial parlera</p>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-lg max-w-none">
                    <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium text-base">
                      {currentTranscription}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  };

  const renderHistoryModal = () => {
    if (!showHistoryModal) {
      return null;
    }

    return (
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Historique des transcriptions"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement de l'historique...</p>
              </div>
            </div>
          ) : transcriptionHistory.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Aucune transcription enregistrée</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {transcriptionHistory.map((session) => (
                <div key={session.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {session.commercial_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold">{session.commercial_name}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(session.start_time)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(session.duration_seconds)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {session.full_transcript.length} caractères
                    </Badge>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 max-h-32 overflow-y-auto">
                    {session.full_transcript || "Aucune transcription disponible"}
                  </div>
                  
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Exporter cette session
                        const blob = new Blob([session.full_transcript], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `transcription-${session.commercial_name}-${formatDate(session.start_time)}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Exporter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowHistoryModal(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  const renderTranscriptionHistoryModal = () => {
    if (!showHistoryModal || !selectedCommercialForHistory) {
      return null;
    }


    return (
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title=""
        maxWidth="max-w-7xl"
      >
        <div className="flex h-[80vh]">
          {/* Section gauche - Liste des transcriptions */}
          <div className="w-1/3 bg-gradient-to-br from-blue-50 to-indigo-50 border-r border-gray-200 flex flex-col">
            {/* Header commercial */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {selectedCommercialForHistory?.avatarFallback}
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedCommercialForHistory?.name}</h2>
                  <p className="text-gray-600 text-sm">{selectedCommercialForHistory?.equipe}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-600">
                      {transcriptionHistory.length} sessions
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Liste des sessions */}
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement...</p>
                  </div>
                </div>
              ) : transcriptionHistory.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Aucune transcription</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {transcriptionHistory.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        selectedSession?.id === session.id
                          ? 'bg-blue-100 border-blue-200 shadow-sm'
                          : 'bg-white hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-800 mb-1">
                        {formatDate(session.start_time)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDuration(session.duration_seconds)}
                      </div>
                      {session.building_name && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Building className="w-3 h-3" />
                          <span className="truncate">{session.building_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 bg-white border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowHistoryModal(false)}
                className="w-full"
              >
                Fermer
              </Button>
            </div>
          </div>

          {/* Section droite - Contenu de la transcription */}
          <div className="w-2/3 bg-white flex flex-col">
            {selectedSession ? (
              <>
                {/* Header transcription */}
                <div className="p-6 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{formatDate(selectedSession.start_time)}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(selectedSession.duration_seconds)}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {selectedSession.full_transcript.length} caractères
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zone de transcription */}
                <div className="flex-1 p-6 overflow-hidden">
                  <div className="h-full bg-gray-50 rounded-lg border border-gray-200 p-6 overflow-y-auto">
                    <div className="prose prose-lg max-w-none">
                      <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium text-base">
                        {selectedSession.full_transcript || "Aucune transcription disponible"}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : transcriptionHistory.length > 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">Sélectionnez une transcription</h3>
                  <p className="text-gray-500">Choisissez une session dans la liste de gauche</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">Aucune transcription</h3>
                  <p className="text-gray-500">Ce commercial n'a pas encore de sessions enregistrées</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  };

  const onlineCommercials = commercials.filter(c => c.isOnline);

  const columns = createColumns(
    audioStreaming,
    handleStartListening,
    handleShowOnMap,
    handleShowHistory
  );

  return (
    <div className="relative space-y-6">
      {/* Statistiques en haut */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{commercials.length}</p>
                <p className="text-sm text-gray-600">Total commerciaux</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <div className="w-5 h-5 bg-green-500 rounded-full" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{onlineCommercials.length}</p>
                <p className="text-sm text-gray-600">Connectés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Headphones className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {audioStreaming.isListening ? '1' : '0'}
                </p>
                <p className="text-sm text-gray-600">Écoute active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau des commerciaux */}
      <div className="w-full">
        <DataTable
          columns={columns}
          data={commercials}
          filterColumnId="name"
          filterPlaceholder="Rechercher un commercial..."
          title="Suivi GPS en temps réel"
        />
      </div>
      
      {renderMapModal()}
      {renderListeningModal()}
      {renderHistoryModal()}
      {renderTranscriptionHistoryModal()}
    </div>
  );
};

export default SuiviPage;