import { useState, useEffect } from 'react';
import { SuiviMap } from './SuiviMap';
import { createColumns } from './suivi-table/columns';
import { DataTable } from '@/components/data-table/DataTable';
import type { CommercialGPS, Zone } from '@/types/types';
import { commercialService } from '@/services/commercial.service';
import { io, Socket } from 'socket.io-client';
import { useAudioStreaming } from '@/hooks/useAudioStreaming';
import { useAuth } from '@/contexts/AuthContext';
import { Headphones, Volume2, VolumeX, MicOff, Users, BarChart3, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui-admin/button';
import { Slider } from '@/components/ui-admin/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Badge } from '@/components/ui-admin/badge';

const SuiviPage = () => {
  const { user } = useAuth();
  const [commercials, setCommercials] = useState<CommercialGPS[]>([]);
  const [selectedCommercial, setSelectedCommercial] = useState<CommercialGPS | null>(null);
  const [zones] = useState<Zone[]>([]);
  const [, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('table');

  // Configuration du streaming audio - détection automatique du protocole
  const getAudioServerUrl = () => {
    const isHttps = window.location.protocol === 'https:';
    const hostname = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const httpsPort = import.meta.env.VITE_PYTHON_HTTPS_PORT || '8443';
    const httpPort = import.meta.env.VITE_PYTHON_HTTP_PORT || '8080';
    
    // Si on est en HTTPS, on utilise HTTPS pour le serveur audio aussi
    if (isHttps) {
      return `https://${hostname}:${httpsPort}`;
    } else {
      return `http://${hostname}:${httpPort}`;
    }
  };

  const audioStreaming = useAudioStreaming({
    serverUrl: getAudioServerUrl(),
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
    const socketUrl = `https://${SERVER_HOST}:${API_PORT}`;
    console.log('🔌 Connexion socket admin GPS:', socketUrl);
    
    const socketConnection = io(socketUrl, {
      secure: true,
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
          position: [48.8566, 2.3522] as [number, number], // Position par défaut (Paris)
          equipe: c.equipe?.nom || 'Aucune équipe',
          isOnline: false, // Sera mis à jour via Socket.IO
          lastUpdate: new Date(),
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
    if (user?.id) {
      audioStreaming.connect();
    }
    
    return () => {
      audioStreaming.disconnect();
    };
  }, [user?.id]);

  const handleSelectCommercial = (commercial: CommercialGPS) => {
    setSelectedCommercial(commercial);
  };

  const handleShowOnMap = (commercial: CommercialGPS) => {
    setSelectedCommercial(commercial);
    setActiveTab('map');
  };

  // Vérifier périodiquement les statuts en ligne/hors ligne
  useEffect(() => {
    const checkOnlineStatus = () => {
      setCommercials(prev => prev.map(commercial => {
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
    try {
      await audioStreaming.startListening(commercialId);
      setShowAudioPanel(true);
      console.log('✅ ADMIN - Écoute démarrée avec succès');
    } catch (error) {
      console.error('❌ ADMIN - Erreur démarrage écoute:', error);
    }
  };

  const handleStopListening = async () => {
    try {
      await audioStreaming.stopListening();
      setShowAudioPanel(false);
    } catch (error) {
      console.error('Erreur arrêt écoute:', error);
    }
  };

  const renderAudioControlPanel = () => {
    if (!showAudioPanel || !audioStreaming.isListening) {
      return null;
    }

    const listeningCommercial = commercials.find(c => c.id === audioStreaming.currentListeningTo);

    return (
      <Card className="fixed bottom-4 right-4 w-80 bg-white shadow-lg border-2 border-blue-500 z-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-blue-600" />
              <span>Écoute en cours</span>
              <Badge variant="default" className="bg-green-500">
                LIVE
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStopListening}
              className="text-red-600 hover:text-red-700"
            >
              <MicOff className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600">
            <strong>{listeningCommercial?.name || 'Commercial'}</strong>
          </div>
          
          <div className="flex items-center gap-2">
            <VolumeX className="h-4 w-4" />
            <Slider
              value={[audioStreaming.audioVolume * 100]}
              onValueChange={(value) => audioStreaming.setVolume(value[0] / 100)}
              max={100}
              min={0}
              step={1}
              className="flex-1 [&>span:first-child]:bg-blue-100 [&>span:first-child>span]:bg-blue-600 [&>span:last-child]:bg-blue-600"
            />
            <Volume2 className="h-4 w-4" />
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            Volume: {Math.round(audioStreaming.audioVolume * 100)}%
          </div>
          
          {audioStreaming.error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {audioStreaming.error}
            </div>
          )}
        </CardContent>
      </Card>
    );
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

  const onlineCommercials = commercials.filter(c => c.isOnline);

  const columns = createColumns(
    audioStreaming,
    handleStartListening,
    handleShowOnMap,
    handleSelectCommercial
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

      {/* Onglets Table/Carte */}
      <div className="w-full">
        <div className="flex border-b border-gray-200 mb-6">
          <Button
            variant={activeTab === 'table' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('table')}
            className="flex items-center gap-2 rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-500"
          >
            <BarChart3 className="w-4 h-4" />
            Vue Tableau
          </Button>
          <Button
            variant={activeTab === 'map' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('map')}
            className="flex items-center gap-2 rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-500"
          >
            <MapIcon className="w-4 h-4" />
            Vue Carte
          </Button>
        </div>
        
        {activeTab === 'table' && (
          <DataTable
            columns={columns}
            data={commercials}
            filterColumnId="name"
            filterPlaceholder="Rechercher un commercial..."
            title="Suivi GPS en temps réel"
            onRowClick={handleSelectCommercial}
          />
        )}
        
        {activeTab === 'map' && (
          <div className="h-[600px]">
            <SuiviMap 
              zones={zones}
              commercials={commercials}
              onMarkerClick={handleSelectCommercial}
              selectedCommercialId={selectedCommercial?.id}
            />
          </div>
        )}
      </div>
      
      {renderAudioControlPanel()}
    </div>
  );
};

export default SuiviPage;