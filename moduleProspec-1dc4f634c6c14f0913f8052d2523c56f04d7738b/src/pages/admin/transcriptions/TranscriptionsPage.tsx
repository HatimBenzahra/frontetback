import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Badge } from '@/components/ui-admin/badge';
import { RefreshCw, Search, User, Mic, MicOff } from 'lucide-react';
import { API_BASE_URL } from '@/config';

// Styles pour l'animation de slide
const slideStyles = `
  .transcriptions-container {
    transform: translateX(0);
    opacity: 1;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .transcriptions-container.slide-out {
    transform: translateX(-100%);
    opacity: 0;
  }
  
  .commercial-card {
    transition: all 0.3s ease-in-out;
  }
  
  .commercial-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }
  
  .commercial-card:active {
    transform: translateY(0);
    transition: all 0.1s ease-in-out;
  }
  
  /* Animation d'entrée pour la nouvelle page */
  .page-enter {
    opacity: 0;
    transform: translateX(100%);
  }
  
  .page-enter-active {
    opacity: 1;
    transform: translateX(0);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

type CommercialItem = {
  id: string;
  name: string;
  sessionsCount: number;
  lastTime: number;
  isOnline?: boolean;
  isTranscribing?: boolean;
  lastSeen?: number;
  currentSession?: string;
};

const TranscriptionsPage = () => {
  const navigate = useNavigate();
  const socket = useSocket('audio-streaming');

  // Statuts
  const [commercialStatus, setCommercialStatus] = useState<Record<string, any>>({});

  // DB
  const [allCommercials, setAllCommercials] = useState<CommercialItem[]>([]);

  // Sélection
  const [query, setQuery] = useState('');

  // État pour le loading du refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  const BASE = API_BASE_URL;

  // DB: commerciaux
  const loadAllCommercials = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${BASE}/api/transcription-history/commercials`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (response.ok) {
        const data = await response.json();
        const commercials = data.commercials || [];
        setAllCommercials(commercials);
      } else {
        console.error('Erreur chargement commerciaux DB:', response.status);
      }
    } catch (error) {
      console.error('Erreur chargement commerciaux DB:', error);
    }
  }, [BASE]);

  useEffect(() => {
    loadAllCommercials();
  }, [loadAllCommercials]);

  // WebSocket: listeners pour les statuts des commerciaux
  useEffect(() => {
    if (!socket) return;

    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_commercials_status');

    const onCommercialsStatus = (data: { status: any[] }) => {
      const statusMap: Record<string, any> = {};
      data.status.forEach(item => { statusMap[item.commercial_id] = item; });
      setCommercialStatus(statusMap);
    };

    socket.on('commercials_status_response', onCommercialsStatus);

    return () => {
      socket.off('commercials_status_response', onCommercialsStatus);
      socket.emit('leaveRoom', 'audio-streaming');
    };
  }, [socket]);

  // Fonction de rafraîchissement complet de la page
  const refreshAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Rafraîchissement complet des données...');
      
      // Recharger les commerciaux
      await loadAllCommercials();
      
      // Demander le statut des commerciaux via WebSocket
      if (socket) {
        socket.emit('request_commercials_status');
      }
      
      console.log('✅ Rafraîchissement terminé');
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAllCommercials, socket]);

  // Raccourci clavier pour le refresh (Ctrl+R ou Cmd+R)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault(); // Empêcher le refresh du navigateur
        if (!isRefreshing) {
          refreshAllData();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [refreshAllData, isRefreshing]);

  // Liste commerciaux fusionnée
  const commercials: CommercialItem[] = useMemo(() => {
    const map = new Map<string, CommercialItem>();
    for (const c of allCommercials) map.set(c.id, { ...c });

    map.forEach((item, cid) => {
      const st = commercialStatus[cid];
      if (st) {
        item.isOnline = st.isOnline;
        item.isTranscribing = st.isTranscribing;
        item.lastSeen = st.lastSeen;
        item.currentSession = st.currentSession;
      }
    });

    let items = Array.from(map.values());
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(i => i.name?.toLowerCase().includes(q) || i.id.includes(query));
    }
    
    // Tri: commerciaux en transcription en premier, puis en ligne, puis hors ligne
    items.sort((a, b) => {
      // Priorité 1: Commerciaux en transcription
      if (a.isTranscribing && !b.isTranscribing) return -1;
      if (!a.isTranscribing && b.isTranscribing) return 1;
      
      // Priorité 2: Commerciaux en ligne (WebSocket connecté)
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      
      // Sinon, trier par lastTime (activité récente)
      return (b.lastTime ?? 0) - (a.lastTime ?? 0);
    });
    
    return items;
  }, [allCommercials, commercialStatus, query]);

  const handleSelectCommercial = (id: string) => {
    // Ajouter une classe pour l'animation de slide
    const container = document.querySelector('.transcriptions-container');
    if (container) {
      container.classList.add('slide-out');
      
      // Attendre la fin de l'animation avant de naviguer
      setTimeout(() => {
        navigate(`/admin/transcriptions/${id}`);
      }, 200); // Durée de l'animation réduite
    } else {
      // Fallback si l'élément n'est pas trouvé
      navigate(`/admin/transcriptions/${id}`);
    }
  };

  // Fonction pour rendre une carte commercial
  const renderCommercialCard = (c: CommercialItem, isTranscribing: boolean) => {
    let statusColor = 'bg-gray-400';
    let statusBg = 'bg-gray-50';
    let borderColor = 'border-gray-200';
    
    if (isTranscribing) {
      statusColor = 'bg-red-500';
      statusBg = 'bg-red-50';
      borderColor = 'border-red-200';
    } else if (c.isOnline) {
      statusColor = 'bg-green-500';
      statusBg = 'bg-green-50';
      borderColor = 'border-green-200';
    }

    return (
      <button
        key={c.id}
        onClick={() => handleSelectCommercial(c.id)}
        className={`w-full text-left rounded-lg p-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-2 hover:${statusBg} ${borderColor} hover:border-opacity-60 commercial-card`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="relative mt-1">
              <div className={`w-3 h-3 ${statusColor} rounded-full flex-shrink-0 ${isTranscribing ? 'animate-pulse' : ''}`} />
              {isTranscribing && (
                <div className="absolute inset-0 w-3 h-3 bg-red-400 rounded-full animate-ping opacity-30"></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-gray-900 truncate">{c.name}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                <span>{c.sessionsCount ?? 0} session{(c.sessionsCount ?? 0) !== 1 ? 's' : ''}</span>
                {/* Affichage de l'état au lieu de lastTime peu fiable */}
                {c.isTranscribing && (
                  <span className="text-xs text-red-600 font-medium">
                    En transcription
                  </span>
                )}
                {!c.isTranscribing && c.isOnline && (
                  <span className="text-xs text-green-600 font-medium">
                    Connecté
                  </span>
                )}
                {!c.isTranscribing && !c.isOnline && (
                  <span className="text-xs text-gray-400">
                    Hors ligne
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 ml-2">
            {isTranscribing && (
              <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs px-2 py-0.5">
                <Mic className="h-3 w-3 mr-1" />
                En cours
              </Badge>
            )}
            {!isTranscribing && c.isOnline && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs px-2 py-0.5">
                En ligne
              </Badge>
            )}
            {!c.isOnline && !isTranscribing && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5">
                <MicOff className="h-3 w-3 mr-1" />
                Hors ligne
              </Badge>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <>
      <style>{slideStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 transcriptions-container transition-all duration-300 ease-in-out">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transcriptions</h1>
            <p className="text-gray-600 mt-1">
              Gestion et consultation des sessions de transcription
              <span className="text-xs text-gray-400 ml-2">(Ctrl+R pour actualiser)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={refreshAllData}
              disabled={isRefreshing}
              variant="outline"
              className="gap-2 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Actualisation...' : 'Actualiser'}
            </Button>
          </div>
        </div>

        {/* Liste des commerciaux en haut */}
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm mb-6">
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100/50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                Commerciaux ({commercials.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600">En transcription</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">En ligne</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-600">Hors ligne</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un commercial..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {commercials.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-12">
                <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                Aucun commercial trouvé
              </div>
            ) : (
              <div>
                {/* Commerciaux en transcription */}
                {commercials.filter(c => c.isTranscribing).length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide">En transcription ({commercials.filter(c => c.isTranscribing).length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {commercials.filter(c => c.isTranscribing).map(c => renderCommercialCard(c, true))}
                    </div>
                  </div>
                )}

                {/* Commerciaux en ligne */}
                {commercials.filter(c => !c.isTranscribing && c.isOnline).length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">En ligne ({commercials.filter(c => !c.isTranscribing && c.isOnline).length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {commercials.filter(c => !c.isTranscribing && c.isOnline).map(c => renderCommercialCard(c, false))}
                    </div>
                  </div>
                )}

                {/* Commerciaux hors ligne */}
                {commercials.filter(c => !c.isTranscribing && !c.isOnline).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Hors ligne ({commercials.filter(c => !c.isTranscribing && !c.isOnline).length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {commercials.filter(c => !c.isTranscribing && !c.isOnline).map(c => renderCommercialCard(c, false))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

          {/* Message d'instruction */}
          <div className="text-center py-20">
            <div className="p-6 bg-gray-100 rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center">
              <User className="h-16 w-16 text-gray-400" />
            </div>
            <div className="text-gray-500 font-medium text-lg mb-2">Sélectionnez un commercial</div>
            <div className="text-sm text-gray-400">Cliquez sur un commercial ci-dessus pour voir ses transcriptions en temps réel et son historique</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TranscriptionsPage;