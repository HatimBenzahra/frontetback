import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { ScrollArea } from '@/components/ui-admin/scroll-area';
import { Modal } from '@/components/ui-admin/Modal';
import { Badge } from '@/components/ui-admin/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { RefreshCw, Search, Copy, Download, Calendar, Clock, Building2, User, Filter, Mic, MicOff, Activity, Target, FileText } from 'lucide-react';
import { type TranscriptionSession } from '@/services/transcriptionHistory.service';

type LiveUpdate = { commercial_id: string; transcript: string; is_final: boolean; timestamp: string; door_id?: string; door_label?: string };

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
  const socket = useSocket('audio-streaming');

  // Live & statuts
  const [liveByCommercial, setLiveByCommercial] = useState<Record<string, string>>({});
  const [doorByCommercial, setDoorByCommercial] = useState<Record<string, string | undefined>>({});
  const [commercialStatus, setCommercialStatus] = useState<Record<string, any>>({});

  // DB
  const [allCommercials, setAllCommercials] = useState<CommercialItem[]>([]);

  // Sélection & sessions ciblées
  const [query, setQuery] = useState('');
  const [selectedCommercialId, setSelectedCommercialId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<TranscriptionSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [openSession, setOpenSession] = useState<TranscriptionSession | null>(null);

  // Filtres pour l'historique
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');       // 'all' | '24h' | '7d' | '30d'
  const [durationFilter, setDurationFilter] = useState<string>('all'); // 'all' | 'short' | 'medium' | 'long'

  const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
  const API_PORT = import.meta.env.VITE_API_PORT || '3000';
  const BASE = `https://${SERVER_HOST}:${API_PORT}`;

  // -------- Utils --------
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

  // -------- DB: charger tous les commerciaux (une fois) --------
  const loadAllCommercials = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}/api/transcription-history/commercials`);
      if (response.ok) {
        const data = await response.json();
        const commercials = data.commercials || [];
        setAllCommercials(commercials);
      } else {
        console.error('❌ Erreur chargement commerciaux DB:', response.status);
      }
    } catch (error) {
      console.error('❌ Erreur chargement commerciaux DB:', error);
    }
  }, [BASE]);

  useEffect(() => {
    loadAllCommercials();
  }, [loadAllCommercials]);

  // -------- DB: charger l'historique UNIQUEMENT du commercial sélectionné --------
  const loadHistoryForSelected = useCallback(async () => {
    if (!selectedCommercialId) { setSessions([]); return; }
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ commercial_id: selectedCommercialId });
      if (buildingFilter !== 'all') params.set('building', buildingFilter);
      if (dateFilter !== 'all') params.set('since', dateFilter);        // à interpréter côté backend
      if (durationFilter !== 'all') params.set('duration', durationFilter);

      const response = await fetch(`${BASE}/api/transcription-history?` + params.toString());
      if (response.ok) {
        const data = await response.json();
        const list: TranscriptionSession[] = (data.history || []).sort(
          (a: TranscriptionSession, b: TranscriptionSession) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
        setSessions(list);
      } else {
        setSessions([]);
        console.error('Erreur chargement historique DB:', response.status);
      }
    } catch (error) {
      console.error('Erreur chargement historique DB:', error);
      setSessions([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [BASE, selectedCommercialId, buildingFilter, dateFilter, durationFilter]);

  useEffect(() => {
    loadHistoryForSelected();
  }, [loadHistoryForSelected]);

  // -------- WebSocket: installer une seule fois les listeners --------
  useEffect(() => {
    if (!socket) return;

    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_commercials_status');

    const onUpdate = (data: LiveUpdate) => {
      setLiveByCommercial(prev => ({ ...prev, [data.commercial_id]: (prev[data.commercial_id] || '') + data.transcript }));
      if (data.door_label || data.door_id) {
        setDoorByCommercial(prev => ({ ...prev, [data.commercial_id]: data.door_label ?? data.door_id }));
      }
    };

    const onCommercialsStatus = (data: { status: any[] }) => {
      const statusMap: Record<string, any> = {};
      data.status.forEach(item => { statusMap[item.commercial_id] = item; });
      setCommercialStatus(statusMap);
    };

    // Si une session se termine pour le commercial sélectionné, recharger uniquement son historique
    const onCompleted = (session: TranscriptionSession) => {
      if (session.commercial_id === selectedCommercialId) {
        setTimeout(() => {
          loadHistoryForSelected();
          socket.emit('request_commercials_status');
        }, 800);
      } else {
        // Sinon, mettre juste à jour les statuts
        socket.emit('request_commercials_status');
      }
    };

    socket.on('transcription_update', onUpdate);
    socket.on('commercials_status_response', onCommercialsStatus);
    socket.on('transcription_session_completed', onCompleted);

    return () => {
      socket.off('transcription_update', onUpdate);
      socket.off('commercials_status_response', onCommercialsStatus);
      socket.off('transcription_session_completed', onCompleted);
      socket.emit('leaveRoom', 'audio-streaming');
    };
  }, [socket, selectedCommercialId, loadHistoryForSelected]);

  // -------- Liste fusionnée des commerciaux (DB + live/status) --------
  const commercials: CommercialItem[] = useMemo(() => {
    const map = new Map<string, CommercialItem>();

    // DB
    for (const c of allCommercials) {
      map.set(c.id, { ...c });
    }

    // Marquer ceux qui émettent du live
    Object.keys(liveByCommercial).forEach(cid => {
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          name: `Commercial ${cid}`,
          sessionsCount: 0,
          lastTime: Date.now(),
        });
      } else {
        const item = map.get(cid)!;
        item.lastTime = Math.max(item.lastTime ?? 0, Date.now());
      }
    });

    // Statuts temps réel
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
    items.sort((a, b) => (b.lastTime ?? 0) - (a.lastTime ?? 0));
    return items;
  }, [allCommercials, liveByCommercial, commercialStatus, query]);

  // -------- Filtres locaux dérivés --------
  const uniqueBuildings = useMemo(() => {
    const buildings = new Set<string>();
    sessions.forEach(s => { if (s.building_name) buildings.add(s.building_name); });
    return Array.from(buildings).sort();
  }, [sessions]);

  const selectedLive = selectedCommercialId ? liveByCommercial[selectedCommercialId] : '';
  const selectedDoor = selectedCommercialId ? doorByCommercial[selectedCommercialId] : undefined;

  // Reset du live visible à la sélection (optionnel)
  const handleSelectCommercial = (id: string) => {
    setSelectedCommercialId(id);
    setLiveByCommercial(prev => ({ ...prev, [id]: '' }));
  };

  // Stats pour l'en-tête
  const onlineCommerciaux = commercials.filter(c => c.isOnline || c.isTranscribing || !!liveByCommercial[c.id]);
  const transcribingCommerciaux = commercials.filter(c => c.isTranscribing);

  return (
    <div className="h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
      <div className="h-full flex flex-col p-6">
        {/* En-tête amélioré */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Transcriptions</h1>
                <p className="text-sm lg:text-base text-gray-600">Suivi en temps réel et historique des sessions commerciales</p>
              </div>
            </div>
            
            {/* Stats rapides */}
            <div className="flex flex-wrap items-center gap-2 lg:gap-4 pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                {onlineCommerciaux.length} en ligne
              </div>
              {transcribingCommerciaux.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  <Mic className="h-3 w-3" />
                  {transcribingCommerciaux.length} en transcription
                </div>
              )}
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => { loadAllCommercials(); loadHistoryForSelected(); }} 
            className="gap-2 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white hover:shadow-md transition-all self-start lg:self-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>

        {/* Contenu principal avec structure améliorée */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          {/* Colonne des commerciaux améliorée */}
          <div className="w-full lg:w-96 lg:flex-shrink-0">
            <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm lg:h-full flex flex-col">
              <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  Commerciaux
                </CardTitle>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                  <Input 
                    className="pl-9 bg-white/80 border-gray-200 focus:bg-white transition-colors" 
                    placeholder="Rechercher un commercial..." 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full">
                  {commercials.length === 0 ? (
                    <div className="text-gray-500 text-sm text-center py-12">
                      <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      Aucun commercial trouvé
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {commercials.map(c => {
                        const isLive = !!liveByCommercial[c.id];
                        const isOnline = c.isOnline || false;
                        const isTranscribing = c.isTranscribing || false;

                        let statusColor = 'bg-gray-400';
                        if (isTranscribing) statusColor = 'bg-red-500';
                        else if (isLive || isOnline) statusColor = 'bg-green-500';

                        return (
                          <button
                            key={c.id}
                            onClick={() => handleSelectCommercial(c.id)}
                            className={`w-full text-left rounded-xl p-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] ${
                              selectedCommercialId === c.id
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg'
                                : 'hover:bg-gray-50/80 border-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="relative">
                                  <div className={`w-3 h-3 ${statusColor} rounded-full flex-shrink-0 ${isTranscribing || isLive ? 'animate-pulse' : ''}`} />
                                  {isTranscribing && (
                                    <div className="absolute inset-0 w-3 h-3 bg-red-400 rounded-full animate-ping opacity-30"></div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm text-gray-900 truncate">{c.name}</div>
                                  <div className="text-xs text-gray-500 mt-1">{c.sessionsCount ?? 0} sessions</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isTranscribing && (
                                  <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs px-2 py-0.5">
                                    <Mic className="h-3 w-3 mr-1" />
                                    Transcription
                                  </Badge>
                                )}
                                {isLive && !isTranscribing && (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs px-2 py-0.5">
                                    <Activity className="h-3 w-3 mr-1" />
                                    Live
                                  </Badge>
                                )}
                                {!isLive && !isTranscribing && isOnline && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5">
                                    En ligne
                                  </Badge>
                                )}
                                {!isOnline && !isLive && !isTranscribing && (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5">
                                    <MicOff className="h-3 w-3 mr-1" />
                                    Hors ligne
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Contenu principal amélioré */}
          <div className="flex-1 flex flex-col space-y-6 min-w-0 lg:min-h-0">
            {/* Section Live améliorée */}
            <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader className="pb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  {selectedCommercialId ? `Live - ${commercials.find(c => c.id === selectedCommercialId)?.name || selectedCommercialId}` : 'Session en direct'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedCommercialId ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <User className="h-10 w-10 text-gray-400" />
                    </div>
                    <div className="text-gray-500 font-medium">Sélectionnez un commercial pour voir sa session en direct</div>
                    <div className="text-sm text-gray-400 mt-1">Les transcriptions en temps réel apparaîtront ici</div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border overflow-hidden m-4">
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4" />
                        <span>Porte: <span className="font-semibold">{selectedDoor || 'Non définie'}</span></span>
                      </div>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        <Activity className="h-3 w-3 mr-1" />
                        En direct
                      </Badge>
                    </div>
                    <div className="p-6">
                      <ScrollArea className="h-48">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono">
                          {selectedLive || 'Aucune transcription en cours...'}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section Historique améliorée */}
            <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader className="pb-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Calendar className="h-4 w-4 text-purple-600" />
                    </div>
                    Historique des sessions
                  </CardTitle>
                  <div className="text-sm text-gray-600 bg-white/80 px-3 py-1 rounded-full">
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {selectedCommercialId && (
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100/50">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Filtres:</span>
                    </div>

                    <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                      <SelectTrigger className="w-48 bg-white/80 border-gray-200">
                        <SelectValue placeholder="Tous les immeubles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les immeubles</SelectItem>
                        {uniqueBuildings.map(building => (
                          <SelectItem key={building} value={building}>{building}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-40 bg-white/80 border-gray-200">
                        <SelectValue placeholder="Toutes les dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les dates</SelectItem>
                        <SelectItem value="24h">Dernières 24h</SelectItem>
                        <SelectItem value="7d">7 derniers jours</SelectItem>
                        <SelectItem value="30d">30 derniers jours</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={durationFilter} onValueChange={setDurationFilter}>
                      <SelectTrigger className="w-40 bg-white/80 border-gray-200">
                        <SelectValue placeholder="Toute durée" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toute durée</SelectItem>
                        <SelectItem value="short">Courtes (&lt;1min)</SelectItem>
                        <SelectItem value="medium">Moyennes (1-5min)</SelectItem>
                        <SelectItem value="long">Longues (&gt;5min)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0">
                {!selectedCommercialId ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Calendar className="h-10 w-10 text-gray-400" />
                    </div>
                    <div className="text-gray-500 font-medium">Sélectionnez un commercial pour voir son historique</div>
                    <div className="text-sm text-gray-400 mt-1">Les sessions passées apparaîtront ici</div>
                  </div>
                ) : loadingHistory ? (
                  <div className="text-center py-16">
                    <div className="relative">
                      <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
                      <div className="absolute inset-0 h-12 w-12 bg-blue-100 rounded-full animate-ping opacity-30"></div>
                    </div>
                    <div className="text-gray-500 font-medium">Chargement de l'historique...</div>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="h-10 w-10 text-gray-400" />
                    </div>
                    <div className="text-gray-500 font-medium">Aucune session trouvée avec les filtres actuels</div>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl text-xs font-semibold text-gray-600 uppercase tracking-wide border border-gray-100">
                      <div className="col-span-2">Date & Heure</div>
                      <div className="col-span-3">Immeuble</div>
                      <div className="col-span-1">Durée</div>
                      <div className="col-span-2">Porte</div>
                      <div className="col-span-4">Transcription</div>
                    </div>

                                         <ScrollArea className="h-[40vh] lg:h-[50vh]">
                      <div className="space-y-2">
                        {sessions.map(session => (
                          <div
                            key={session.id}
                            className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl cursor-pointer transition-all duration-300 group border border-transparent hover:border-blue-200 hover:shadow-md"
                            onClick={() => setOpenSession(session)}
                          >
                            <div className="col-span-2 flex items-center gap-2 min-w-0">
                              <div className="p-1.5 bg-blue-100 rounded-lg">
                                <Clock className="h-3 w-3 text-blue-600 flex-shrink-0" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-gray-900 truncate">
                                  {formatDate(session.start_time)}
                                </div>
                              </div>
                            </div>

                            <div className="col-span-3 flex items-center min-w-0">
                              <div className="min-w-0 flex-1">
                                <div
                                  className="text-sm text-gray-700 truncate font-medium"
                                  title={session.building_name || 'Non défini'}
                                >
                                  {session.building_name || 'Non défini'}
                                </div>
                              </div>
                            </div>

                            <div className="col-span-1 flex items-center">
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                                {formatDuration(session.duration_seconds)}
                              </Badge>
                            </div>

                            <div className="col-span-2 flex items-center min-w-0">
                              <span className="text-sm text-gray-600 truncate font-medium" title={session.last_door_label || 'Non définie'}>
                                {session.last_door_label || 'Non définie'}
                              </span>
                            </div>

                            <div className="col-span-4 flex items-center min-w-0">
                              <p className="text-sm text-gray-700 line-clamp-2 group-hover:text-gray-900 transition-colors">
                                {session.full_transcript || 'Aucune transcription'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal détails améliorée */}
      <Modal
        isOpen={!!openSession}
        onClose={() => setOpenSession(null)}
        title="Détails de la session"
        maxWidth="sm:max-w-4xl"
      >
        {openSession && (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 gap-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <User className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Commercial</span>
                </div>
                <p className="text-gray-900 font-bold">
                  {openSession.commercial_name || openSession.commercial_id}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 rounded-lg">
                    <Building2 className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Immeuble</span>
                </div>
                <p className="text-gray-900 font-bold">
                  {openSession.building_name || 'Non défini'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Calendar className="h-3 w-3 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Période</span>
                </div>
                <div className="text-sm text-gray-600">
                  <div className="font-medium">{formatDate(openSession.start_time)}</div>
                  <div className="font-medium">→ {formatDate(openSession.end_time)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-100 rounded-lg">
                    <Clock className="h-3 w-3 text-orange-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Durée</span>
                </div>
                <Badge variant="secondary" className="font-bold bg-orange-100 text-orange-800">
                  {formatDuration(openSession.duration_seconds)}
                </Badge>
              </div>

              {openSession.last_door_label && (
                <div className="space-y-3 col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <Target className="h-3 w-3 text-indigo-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Dernière porte visitée</span>
                  </div>
                  <Badge variant="outline" className="font-bold border-indigo-200 text-indigo-700 bg-indigo-50">
                    {openSession.last_door_label}
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(openSession.full_transcript)}
                className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Copy className="h-4 w-4" />
                Copier la transcription
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText(
                    `transcription_${openSession.commercial_name || openSession.commercial_id}_${new Date(openSession.start_time).toISOString().split('T')[0]}.txt`,
                    openSession.full_transcript
                  )
                }
                className="gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Transcription complète
              </h4>
              <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-inner">
                <pre className="whitespace-pre-wrap text-sm p-6 leading-relaxed text-gray-700 font-mono">
                  {openSession.full_transcript || 'Aucune transcription disponible'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TranscriptionsPage;