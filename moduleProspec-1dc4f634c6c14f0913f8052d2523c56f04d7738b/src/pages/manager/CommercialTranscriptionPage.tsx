import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { ScrollArea } from '@/components/ui-admin/scroll-area';
import { Modal } from '@/components/ui-admin/Modal';
import { Badge } from '@/components/ui-admin/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { ArrowLeft, RefreshCw, Copy, Download, Calendar, Clock, Building2, User, Filter, Activity, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
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
  }, [loadCommercialSessions]);

  // WebSocket: listeners
  useEffect(() => {
    if (!socket || !commercialId) return;

    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_commercials_status');

    const onLiveUpdate = (data: LiveUpdate) => {
      if (data.commercial_id !== commercialId) return;

      if (data.is_final) {
        setLiveCommitted(prev => {
          const newText = prev + ' ' + data.transcript;
          return newText.length > liveMaxChars 
            ? '...' + newText.slice(-(liveMaxChars - 3))
            : newText;
        });
        setLivePartial('');
      } else {
        if (partialTimerRef.current) {
          window.clearTimeout(partialTimerRef.current);
        }
        partialTimerRef.current = window.setTimeout(() => {
          setLivePartial(data.transcript || '');
        }, 50);
      }

      if (data.door_label) {
        setCurrentDoor(data.door_label);
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
  }, [socket, commercialId, loadCommercialSessions, liveMaxChars]);

  // Fonction de rafraîchissement
  const refreshAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadCommercialSessions();
      if (socket) {
        socket.emit('request_commercials_status');
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCommercialSessions, socket]);

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
          case 'today': return diffMs < dayMs;
          case 'week': return diffMs < 7 * dayMs;
          case 'month': return diffMs < 30 * dayMs;
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

  useEffect(() => {
    const timer = setTimeout(() => setIsPageLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/manager/transcriptions')}
              className="p-2 hover:bg-white/50 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {commercialInfo?.name || commercialId}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-gray-600">Sessions de transcription</p>
                {commercialStatus && (
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${commercialStatus.isTranscribing ? 'bg-red-500 animate-pulse' : commercialStatus.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-500">
                      {commercialStatus.isTranscribing ? 'En transcription' : commercialStatus.isOnline ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={refreshAllData}
            disabled={isRefreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualisation...' : 'Actualiser'}
          </Button>
        </div>

        {/* Live transcription */}
        {commercialStatus?.isTranscribing && (
          <Card className="shadow-lg border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <Activity className="h-5 w-5" />
                </div>
                Transcription en direct
                {currentDoor && (
                  <Badge variant="secondary" className="ml-2 bg-red-100 text-red-800">
                    {currentDoor}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/80 p-4 rounded-lg min-h-[120px] max-h-[300px] overflow-y-auto">
                <div className="text-sm text-gray-700">
                  {liveCommitted && (
                    <span className="font-medium text-gray-900">{liveCommitted}</span>
                  )}
                  {livePartial && (
                    <span className="text-gray-600 italic ml-1">{livePartial}</span>
                  )}
                  {!liveCommitted && !livePartial && (
                    <span className="text-gray-400 italic">En attente de transcription...</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtres */}
        <Card className="shadow-lg bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filtres et historique ({filteredSessions.length} sessions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Immeuble</label>
                <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les immeubles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les immeubles</SelectItem>
                    {uniqueBuildings.map(building => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Période</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les dates</SelectItem>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Durée</label>
                <Select value={durationFilter} onValueChange={setDurationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les durées" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les durées</SelectItem>
                    <SelectItem value="short">Courte (&lt; 1min)</SelectItem>
                    <SelectItem value="medium">Moyenne (1-5min)</SelectItem>
                    <SelectItem value="long">Longue (&gt; 5min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Liste des sessions */}
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Chargement des sessions...</p>
              </div>
            ) : paginatedSessions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">Aucune session trouvée</p>
                <p className="text-sm text-gray-400 mt-1">
                  {sessions.length === 0 ? 'Ce commercial n\'a pas encore de sessions de transcription' : 'Aucune session ne correspond aux filtres sélectionnés'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setOpenSession(session)}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium text-gray-900">
                            {formatDate(session.start_time)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {formatDuration(session.duration_seconds)}
                          </Badge>
                          {session.building_name && (
                            <Badge variant="outline" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {session.building_name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {session.full_transcript.slice(0, 120)}
                          {session.full_transcript.length > 120 && '...'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyText(session.full_transcript);
                        }}
                        className="p-2"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadText(
                            `transcription_${session.commercial_name}_${formatDate(session.start_time).replace(/[/:\s]/g, '_')}.txt`,
                            session.full_transcript
                          );
                        }}
                        className="p-2"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-gray-500">
                      Page {currentPage} sur {totalPages} ({filteredSessions.length} sessions)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2"
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

        {/* Modal de détail de session */}
        {openSession && (
          <Modal isOpen={true} onClose={() => setOpenSession(null)} size="xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Détail de la session</h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(openSession.full_transcript)}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadText(
                      `transcription_${openSession.commercial_name}_${formatDate(openSession.start_time).replace(/[/:\s]/g, '_')}.txt`,
                      openSession.full_transcript
                    )}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="font-medium">{formatDate(openSession.start_time)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Durée</div>
                  <div className="font-medium">{formatDuration(openSession.duration_seconds)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Immeuble</div>
                  <div className="font-medium">{openSession.building_name || 'N/A'}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Portes visitées</div>
                  <div className="font-medium">{openSession.visited_doors.length}</div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Transcription complète</h3>
                <ScrollArea className="h-96">
                  <div className="p-4 bg-gray-50 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                    {openSession.full_transcript}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default ManagerCommercialTranscriptionPage;