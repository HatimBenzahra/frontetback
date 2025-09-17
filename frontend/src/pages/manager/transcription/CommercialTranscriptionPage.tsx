import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { ScrollArea } from '@/components/ui-admin/scroll-area';
import { Modal } from '@/components/ui-admin/Modal';
import { Badge } from '@/components/ui-admin/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { ArrowLeft, RefreshCw, Copy, Download, Calendar, Building2, User, Filter, Activity, FileText, ChevronLeft, ChevronRight, Trash2, MoreVertical } from 'lucide-react';
import { API_BASE_URL } from '@/config';

type TranscriptionSession = {
  id: string;
  commercial_id: string;
  commercial_name: string;
  start_time: string;
  end_time: string;
  full_transcript: string;
  duration_seconds: number;
  building_id?: string;
  building_name?: string;
  visited_doors: string[];
  createdAt: string;
  updatedAt: string;
};

type LiveUpdate = {
  commercial_id: string;
  transcript: string;
  is_final: boolean;
  timestamp: string;
  door_id?: string;
  door_label?: string;
};

const ManagerCommercialTranscriptionPage = () => {
  const { commercialId } = useParams<{ commercialId: string }>();
  const navigate = useNavigate();
  const socket = useSocket('audio-streaming');

  // Live & statuts
  const [liveCommitted, setLiveCommitted] = useState<string>('');
  const [livePartial, setLivePartial] = useState<string>('');
  const [currentDoor, setCurrentDoor] = useState<string>('');
  const [commercialStatus, setCommercialStatus] = useState<any>(null);

  // DB
  const [commercialInfo, setCommercialInfo] = useState<any>(null);
  const [sessions, setSessions] = useState<TranscriptionSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [openSession, setOpenSession] = useState<TranscriptionSession | null>(null);

  // Filtres pour l'historique
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');

  // État pour le loading du refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // États pour la suppression
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [liveMaxChars] = useState<number>(8000);
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  // Debounce partiels
  const partialTimerRef = useRef<number | null>(null);

  const BASE = API_BASE_URL;

  // Utils
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const copyText = (text: string) => navigator.clipboard.writeText(text).catch(() => {});
  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  // Fonction de suppression d'une session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      setDeletingSessionId(sessionId);
      
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${BASE}/api/transcription-history/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      // Mettre à jour la liste locale
      setSessions(prevSessions => prevSessions.filter(session => session.id !== sessionId));
      
      // Fermer la modal si la session supprimée était ouverte
      if (openSession?.id === sessionId) {
        setOpenSession(null);
      }
      
      console.log('✅ Session supprimée avec succès:', sessionId);
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la session:', error);
    } finally {
      setDeletingSessionId(null);
      setShowDeleteConfirm(null);
    }
  };

  // Fonction de suppression en masse
  const handleBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      const token = localStorage.getItem('access_token');
      
      const deletePromises = sessions.map(session => 
        fetch(`${BASE}/api/transcription-history/${session.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        })
      );
      
      await Promise.all(deletePromises);
      
      // Vider la liste
      setSessions([]);
      setOpenSession(null);
      
      console.log('✅ Toutes les sessions supprimées avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la suppression en masse:', error);
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  // DB: historique des sessions du commercial pour ce manager
  const loadCommercialSessions = useCallback(async () => {
    if (!commercialId) return;
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${BASE}/manager-space/transcriptions/commercial/${commercialId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
        // Extraire les infos du commercial depuis la première session
        if (data.length > 0) {
          setCommercialInfo({
            id: data[0].commercial_id,
            name: data[0].commercial_name
          });
        }
        // Reset à la première page quand on charge de nouvelles données
        setCurrentPage(1);
      } else {
        console.error('Erreur chargement sessions commercial manager:', response.status);
      }
    } catch (error) {
      console.error('Erreur chargement sessions commercial manager:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [commercialId, BASE]);

  useEffect(() => {
    loadCommercialSessions();
    
    // Animation d'entrée de la page
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [loadCommercialSessions]);

  // Reset de la pagination quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [buildingFilter, dateFilter, durationFilter]);

  // Gestion du modal et du scroll
  useEffect(() => {
    if (openSession) {
      // Empêcher le scroll de la page quand le modal est ouvert
      document.body.style.overflow = 'hidden';
      
      // Gestion de la touche Escape
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setOpenSession(null);
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    } else {
      // Restaurer le scroll de la page
      document.body.style.overflow = 'unset';
    }
  }, [openSession]);

  // WebSocket: listeners
  useEffect(() => {
    if (!socket || !commercialId) return;

    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_commercials_status');

    const onLiveUpdate = async (data: LiveUpdate) => {
      if (data.commercial_id !== commercialId) return;

      let chunk = data.transcript || '';

      if (data.door_label || data.door_id) {
        setCurrentDoor(data.door_label ?? data.door_id ?? '');
      }

      // Traitement centralisé via API backend
      try {
        const response = await fetch(`${BASE}/api/transcription-history/process-chunk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunk,
            committed: liveCommitted,
            isFinal: data.is_final,
            maxChars: liveMaxChars
          })
        });

        if (response.ok) {
          const result = await response.json();
          chunk = result.processedChunk;

          if (data.is_final) {
            setLiveCommitted(result.newCommitted);
            setLivePartial('');

            if (partialTimerRef.current) {
              window.clearTimeout(partialTimerRef.current);
              partialTimerRef.current = null;
            }
          } else {
            const run = () => setLivePartial(chunk);
            if (partialTimerRef.current) window.clearTimeout(partialTimerRef.current);
            partialTimerRef.current = window.setTimeout(run, 150);
          }
        } else {
          // Fallback
          chunk = chunk.replace(/\s+/g, ' ').trim();
      if (data.is_final) {
        setLiveCommitted(prev => {
              const merged = prev + (prev ? ' ' : '') + chunk;
              return merged.length > liveMaxChars ? merged.slice(merged.length - liveMaxChars) : merged;
        });
        setLivePartial('');
      } else {
            const run = () => setLivePartial(chunk);
            if (partialTimerRef.current) window.clearTimeout(partialTimerRef.current);
            partialTimerRef.current = window.setTimeout(run, 150);
          }
        }
      } catch (error) {
        console.error('Erreur traitement chunk:', error);
        // Fallback simple
        chunk = chunk.replace(/\s+/g, ' ').trim();
        if (data.is_final) {
          setLiveCommitted(prev => prev + (prev ? ' ' : '') + chunk);
        }
      }
    };

    const onCommercialsStatus = (data: { status: any[] }) => {
      const status = data.status.find(s => s.commercial_id === commercialId);
      setCommercialStatus(status || null);
    };

    const onSessionStart = (data: any) => {
      if (data.commercial_id === commercialId) {
        setLiveCommitted('');
        setLivePartial('');
        setCurrentDoor('');
      }
    };

    const onSessionEnd = (data: any) => {
      if (data.commercial_id === commercialId) {
        // Recharger les sessions après un court délai
        setTimeout(() => {
          loadCommercialSessions();
        }, 1000);
      }
    };

    socket.on('live_transcription_update', onLiveUpdate);
    socket.on('commercials_status_response', onCommercialsStatus);
    socket.on('transcription_session_start', onSessionStart);
    socket.on('transcription_session_end', onSessionEnd);

    return () => {
      socket.off('live_transcription_update', onLiveUpdate);
      socket.off('commercials_status_response', onCommercialsStatus);
      socket.off('transcription_session_start', onSessionStart);
      socket.off('transcription_session_end', onSessionEnd);
      socket.emit('leaveRoom', 'audio-streaming');
      if (partialTimerRef.current) {
        window.clearTimeout(partialTimerRef.current);
      }
    };
  }, [socket, commercialId, loadCommercialSessions, liveMaxChars, liveCommitted, BASE]);

  // Fonction de rafraîchissement
  const refreshAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Rafraîchissement complet des données...');
      
      await loadCommercialSessions();
      
      if (socket) {
        socket.emit('request_commercials_status');
      }
      
      console.log('✅ Rafraîchissement terminé');
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCommercialSessions, socket]);

  // Raccourci clavier pour le refresh
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        if (!isRefreshing) {
          refreshAllData();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [refreshAllData, isRefreshing]);

  // Gestion des filtres
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];

    // Filtre par immeuble
    if (buildingFilter !== 'all') {
      filtered = filtered.filter(s => s.building_id === buildingFilter);
    }

    // Filtre par date
    if (dateFilter !== 'all') {
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      
      filtered = filtered.filter(s => {
        const sessionDate = new Date(s.start_time);
        const diffMs = now.getTime() - sessionDate.getTime();
        
        switch (dateFilter) {
          case '24h': return diffMs < dayMs;
          case '7d': return diffMs < 7 * dayMs;
          case '30d': return diffMs < 30 * dayMs;
          default: return true;
        }
      });
    }

    // Filtre par durée
    if (durationFilter !== 'all') {
      filtered = filtered.filter(s => {
        const duration = s.duration_seconds;
        switch (durationFilter) {
          case 'short': return duration < 60;
          case 'medium': return duration >= 60 && duration <= 300;
          case 'long': return duration > 300;
          default: return true;
        }
      });
    }

    return filtered.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [sessions, buildingFilter, dateFilter, durationFilter]);

  // Pagination
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);

  // Immeuble unique pour les filtres
  const uniqueBuildings = useMemo(() => {
    const buildingMap = new Map<string, string>();
    sessions.forEach(s => {
      if (s.building_id && s.building_name) {
        buildingMap.set(s.building_id, s.building_name);
      }
    });
    return Array.from(buildingMap.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  // Dérivés UI
  const selectedLive = (liveCommitted + (livePartial ? (liveCommitted ? ' ' : '') + livePartial : '')).trim();
  const isTranscribing = commercialStatus?.isTranscribing || false;
  const isOnline = commercialStatus?.isOnline || false;

  // Fonctions pour la pagination
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (!isPageLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="bg-white rounded-lg p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 transition-all duration-500 ease-out ${
      isPageLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
    }`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/manager/transcriptions')}
              variant="outline"
              className="gap-2 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {commercialInfo?.name || `Commercial ${commercialId}`}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-gray-600">Transcriptions en temps réel et historique</span>
                <span className="text-xs text-gray-400">(Ctrl+R pour actualiser)</span>
                {sessions.length > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                    {sessions.length} session{sessions.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
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
          
          {sessions.length > 0 && (
            <Button
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={isBulkDeleting}
              variant="outline"
              className="gap-2 bg-red-50/80 backdrop-blur-sm border-red-200 hover:bg-red-100 text-red-700 hover:text-red-800 disabled:opacity-50"
            >
              <Trash2 className={`h-4 w-4 ${isBulkDeleting ? 'animate-pulse' : ''}`} />
              {isBulkDeleting ? 'Suppression...' : 'Vider tout'}
            </Button>
          )}
          </div>
        </div>

        {/* Statut du commercial */}
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100/50">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              Statut du commercial
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  isTranscribing ? 'bg-red-500 animate-pulse' : 
                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                {isTranscribing && (
                  <div className="absolute inset-0 w-3 h-3 bg-red-400 rounded-full animate-ping opacity-30"></div>
                )}
                <span className="text-sm font-medium">
                  {isTranscribing ? 'En transcription' : 
                   isOnline ? 'Connecté' : 'Hors ligne'}
                </span>
              </div>
              {currentDoor && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Porte: {currentDoor}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section Live Transcription - Pleine largeur */}
        {(isTranscribing || isOnline || selectedLive) && (
          <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm h-[400px] mb-6">
            <CardHeader className="pb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100/50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                Transcription en temps réel
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-80px)]">
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border overflow-hidden m-4 h-[calc(100%-32px)]">
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4" />
                    <span>Porte: <span className="font-semibold">{currentDoor || 'Non définie'}</span></span>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    <Activity className="h-3 w-3 mr-1" />
                    En direct
                  </Badge>
                </div>
                <div className="p-6 h-[calc(100%-64px)]">
                  <ScrollArea className="h-full">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono">
                      {selectedLive || 'Aucune transcription en cours...'}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Historique - En dessous */}
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100/50 flex-shrink-0">
            <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-purple-600" />
                </div>
                Historique des sessions
            </CardTitle>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600 bg-white/80 px-3 py-1 rounded-full">
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                  {totalPages > 1 && (
                    <span className="ml-2 text-gray-500">
                      (page {currentPage}/{totalPages})
                    </span>
                  )}
                </div>
                <Button
                  onClick={loadCommercialSessions}
                  disabled={loadingHistory}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-white/80 hover:bg-white"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingHistory ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100/50">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtres:</span>
              </div>

                <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                <SelectTrigger className="w-40 bg-white/80 border-gray-200">
                  <SelectValue placeholder="Immeubles" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                    {uniqueBuildings.map(building => (
                    <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-32 bg-white/80 border-gray-200">
                  <SelectValue placeholder="Dates" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="24h">24h</SelectItem>
                  <SelectItem value="7d">7j</SelectItem>
                  <SelectItem value="30d">30j</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={durationFilter} onValueChange={setDurationFilter}>
                <SelectTrigger className="w-32 bg-white/80 border-gray-200">
                  <SelectValue placeholder="Durée" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="short">&lt;1min</SelectItem>
                  <SelectItem value="medium">1-5min</SelectItem>
                  <SelectItem value="long">&gt;5min</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Chargement des sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <FileText className="h-10 w-10 text-gray-400" />
                </div>
                <div className="text-gray-500 font-medium">Aucune session trouvée</div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="px-4 py-4">
                  <div className="space-y-2">
                    {paginatedSessions.map(session => {
                      const displayTranscript = session.full_transcript || '';

                      return (
                  <div
                    key={session.id}
                          className="p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl transition-all duration-300 group border border-transparent hover:border-blue-200 hover:shadow-lg relative transform hover:scale-[1.02] bg-white/80 backdrop-blur-sm"
                  >
                    {/* Bouton de suppression */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {showDeleteConfirm === session.id ? (
                        <div className="flex items-center gap-2 bg-white rounded-lg shadow-lg border border-red-200 p-2">
                          <span className="text-xs text-red-600 font-medium">Supprimer ?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            disabled={deletingSessionId === session.id}
                          >
                            {deletingSessionId === session.id ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(null);
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(session.id);
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Contenu de la session */}
                    <div
                      className="cursor-pointer"
                      onClick={() => setOpenSession(session)}
                    >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                              <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="text-xs font-semibold text-gray-900">
                                  {formatDate(session.start_time)}
                      </div>
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                            {formatDuration(session.duration_seconds)}
                          </Badge>
                              </div>
                              <div className="text-xs text-gray-600 mb-2">
                                <span className="font-medium">
                                  {session.building_name || 'Non défini'}
                                </span>
                                {session.visited_doors && session.visited_doors.length > 0 && (
                                  <span className="ml-2">- Portes: {session.visited_doors.join(', ')}</span>
                          )}
                        </div>
                              <div className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                                {displayTranscript ? (
                                  <p className="line-clamp-3 leading-relaxed">
                                    {displayTranscript}
                                  </p>
                                ) : (
                                  <p className="text-gray-500 italic">Aucune transcription disponible</p>
                                )}
                                {displayTranscript && displayTranscript.length > 200 && (
                                  <p className="text-xs text-blue-600 mt-1 font-medium">
                                    Cliquer pour voir la transcription complète
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Contrôles de pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    <div className="text-sm text-gray-600">
                      Affichage {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredSessions.length)} sur {filteredSessions.length} sessions
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {/* Numéros de pages */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNumber;
                          if (totalPages <= 5) {
                            pageNumber = i + 1;
                          } else if (currentPage <= 3) {
                            pageNumber = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNumber = totalPages - 4 + i;
                          } else {
                            pageNumber = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNumber}
                              onClick={() => goToPage(pageNumber)}
                              variant={currentPage === pageNumber ? "default" : "outline"}
                              size="sm"
                              className="h-8 w-8 p-0 text-xs"
                            >
                              {pageNumber}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal détails */}
      <Modal
        isOpen={!!openSession}
        onClose={() => setOpenSession(null)}
        title="Détails de la session de transcription"
        maxWidth="max-w-7xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        {openSession && (
          <div className="flex flex-col lg:flex-row gap-6 max-h-[80vh] overflow-hidden">
            {/* Colonne gauche - Informations */}
            <div className="w-full lg:w-1/3 space-y-6 overflow-y-auto lg:pr-4 max-h-[70vh] lg:max-h-[70vh]">
              <div className="text-sm text-muted-foreground">
                Informations détaillées de la session de transcription.
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    Informations générales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Commercial</span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {openSession.commercial_name || openSession.commercial_id}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Période</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="font-medium">{formatDate(openSession.start_time)}</div>
                      <div className="font-medium">→ {formatDate(openSession.end_time)}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Durée</span>
                    </div>
                    <Badge variant="secondary" className="font-bold bg-orange-100 text-orange-800">
                      {formatDuration(openSession.duration_seconds)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-600" />
                    Localisation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Adresse de l'immeuble</span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {openSession.building_name || 'Non défini'}
                    </p>
                  </div>

                  {openSession.visited_doors && openSession.visited_doors.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          {openSession.visited_doors.length === 1 ? 'Porte visitée' : 'Portes visitées'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {openSession.visited_doors.map((door, index) => (
                          <Badge key={index} variant="outline" className="font-bold border-indigo-200 text-indigo-700 bg-indigo-50">
                            {door}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Colonne droite - Transcription */}
            <div className="flex-1 flex flex-col max-h-[70vh]">
              <Card className="flex-1 flex flex-col max-h-[70vh]">
                <CardHeader className="flex-shrink-0 bg-gradient-to-r from-purple-50 to-pink-50 border-b">
              <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      Transcription complète
                    </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                        onClick={() => copyText(openSession.full_transcript || '')}
                        className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors hidden sm:flex"
                      >
                        <Copy className="h-3 w-3" />
                        <span className="hidden md:inline">Copier</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyText(openSession.full_transcript || '')}
                        className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors sm:hidden p-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadText(
                            `transcription_${openSession.commercial_name || openSession.commercial_id}_${new Date(openSession.start_time).toISOString().split('T')[0]}.txt`,
                            openSession.full_transcript || ''
                          )
                        }
                        className="gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors hidden sm:flex"
                      >
                        <Download className="h-3 w-3" />
                        <span className="hidden md:inline">Télécharger</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                        onClick={() =>
                          downloadText(
                            `transcription_${openSession.commercial_name || openSession.commercial_id}_${new Date(openSession.start_time).toISOString().split('T')[0]}.txt`,
                            openSession.full_transcript || ''
                          )
                        }
                        className="gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors sm:hidden p-2"
                      >
                        <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 min-h-0 overflow-hidden">
                  <div className="h-full bg-gradient-to-br from-slate-50 to-white border-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent_50%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,131,131,0.03),transparent_50%)]" />
                    
                    <ScrollArea className="h-full relative z-10 max-h-[60vh]">
                      <div className="p-4 sm:p-6">
                        {openSession.full_transcript ? (
                          <div className="relative">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 pb-3 border-b border-gray-200/60 gap-2">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                  <span className="font-medium">Transcription active</span>
                </div>
                                <span className="text-gray-400">•</span>
                                <span>{openSession.full_transcript.length.toLocaleString()} caractères</span>
                                <span className="text-gray-400">•</span>
                                <span>{openSession.full_transcript.split(' ').length.toLocaleString()} mots</span>
                </div>
              </div>

                            <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/60 shadow-sm">
                              <div className="p-4 sm:p-6">
                                <pre className="whitespace-pre-wrap text-xs sm:text-sm leading-6 sm:leading-7 text-gray-800 font-sans tracking-wide">
                    {openSession.full_transcript}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center py-16 px-8">
                              <div className="relative mb-6">
                                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full mx-auto flex items-center justify-center shadow-lg">
                                  <FileText className="h-10 w-10 text-purple-500" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-md">
                                  <span className="text-xs text-white font-bold">!</span>
                                </div>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                Aucune transcription disponible
                              </h3>
                              <p className="text-sm text-gray-500 leading-relaxed max-w-md">
                                Cette session ne contient pas encore de contenu transcrit. 
                                La transcription apparaîtra automatiquement une fois le traitement terminé.
                              </p>
                              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full border border-blue-200/60">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-medium text-blue-700">En attente de données</span>
                              </div>
                            </div>
                          </div>
                        )}
                  </div>
                </ScrollArea>
              </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de confirmation pour suppression en masse */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Supprimer toutes les sessions</h3>
                <p className="text-sm text-gray-600">Cette action est irréversible</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Êtes-vous sûr de vouloir supprimer toutes les <strong>{sessions.length}</strong> sessions de transcription ? 
              Cette action ne peut pas être annulée.
            </p>
            
            <div className="flex items-center gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkDeleting}
                className="px-6"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="px-6 gap-2"
              >
                {isBulkDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Supprimer tout
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerCommercialTranscriptionPage;