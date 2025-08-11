import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { ScrollArea } from '@/components/ui-admin/scroll-area';
import { Modal } from '@/components/ui-admin/Modal';
import { Badge } from '@/components/ui-admin/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { RefreshCw, Search, Copy, Download, Calendar, Clock, Building2, User, Filter } from 'lucide-react';
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

  // -------- DB: charger l’historique UNIQUEMENT du commercial sélectionné --------
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

  return (
    <div className="flex flex-col h-full p-6 space-y-6 bg-gradient-to-br from-slate-50 to-white">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Transcriptions</h1>
          <p className="text-slate-600 mt-1">Suivi en temps réel et historique des sessions commerciales</p>
        </div>
        <Button variant="outline" onClick={() => { loadAllCommercials(); loadHistoryForSelected(); }} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6 ">
        {/* Colonne des commerciaux */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-4">
          <Card className="shadow-sm border-0 bg-white h-[calc(100vh-220px)] flex flex-col">
            <CardHeader className="pb-3 bg-white">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-slate-600" />
                Commerciaux
              </CardTitle>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                <Input className="pl-9" placeholder="Rechercher un commercial..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ScrollArea className="h-full">
                {commercials.length === 0 ? (
                  <div className="text-slate-500 text-sm text-center py-8">Aucun commercial trouvé</div>
                ) : (
                  <div className="space-y-3">
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
                          className={`w-full text-left rounded-lg p-2.5 transition-all ${
                            selectedCommercialId === c.id
                              ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                              : 'hover:bg-slate-50 border-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-2 h-2 ${statusColor} rounded-full flex-shrink-0 ${isTranscribing || isLive ? 'animate-pulse' : ''}`} />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-slate-900 truncate">{c.name}</div>
                                <div className="text-xs text-slate-500">{c.sessionsCount ?? 0} sessions</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {isTranscribing && (
                                <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                                  Transcription
                                </Badge>
                              )}
                              {isLive && !isTranscribing && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                  Live
                                </Badge>
                              )}
                              {!isLive && !isTranscribing && isOnline && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                  En ligne
                                </Badge>
                              )}
                              {!isOnline && !isLive && !isTranscribing && (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
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

        {/* Contenu principal */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-8 space-y-6">
          {/* Section Live */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                {selectedCommercialId ? `Live - ${commercials.find(c => c.id === selectedCommercialId)?.name || selectedCommercialId}` : 'Session en direct'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedCommercialId ? (
                <div className="text-center py-12">
                  <User className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <div className="text-slate-500">Sélectionnez un commercial pour voir sa session en direct</div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4" />
                      <span>Porte: <span className="font-semibold">{selectedDoor || 'Non définie'}</span></span>
                    </div>
                    <Badge variant="secondary" className="bg-white bg-opacity-20 text-white border-white border-opacity-30">
                      En direct
                    </Badge>
                  </div>
                  <div className="p-6">
                    <ScrollArea className="h-48">
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                        {selectedLive || 'Aucune transcription en cours...'}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section Historique avec filtres */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-slate-600" />
                  Historique des sessions
                </CardTitle>
                <div className="text-sm text-slate-500">
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {selectedCommercialId && (
                <div className="flex flex-wrap gap-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Filtres:</span>
                  </div>

                  <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                    <SelectTrigger className="w-48">
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
                    <SelectTrigger className="w-40">
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
                    <SelectTrigger className="w-40">
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

            <CardContent>
              {!selectedCommercialId ? (
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <div className="text-slate-500">Sélectionnez un commercial pour voir son historique</div>
                </div>
              ) : loadingHistory ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <div className="text-slate-500">Chargement de l'historique...</div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-slate-500">Aucune session trouvée avec les filtres actuels</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50 rounded-lg text-xs font-medium text-slate-600 uppercase tracking-wide">
                    <div className="col-span-2">Date & Heure</div>
                    <div className="col-span-3">Immeuble</div>
                    <div className="col-span-1">Durée</div>
                    <div className="col-span-2">Porte</div>
                    <div className="col-span-4">Transcription</div>
                  </div>

                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-1">
                      {sessions.map(session => (
                        <div
                          key={session.id}
                          className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-slate-200"
                          onClick={() => setOpenSession(session)}
                        >
                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-slate-900 truncate">
                                {formatDate(session.start_time)}
                              </div>
                            </div>
                          </div>

                          <div className="col-span-3 flex items-center min-w-0">
                            <div className="min-w-0 flex-1">
                              <div
                                className="text-sm text-slate-700 truncate"
                                title={session.building_name || 'Non défini'}
                              >
                                {session.building_name || 'Non défini'}
                              </div>
                            </div>
                          </div>

                          <div className="col-span-1 flex items-center">
                            <Badge variant="secondary" className="text-xs">
                              {formatDuration(session.duration_seconds)}
                            </Badge>
                          </div>

                          <div className="col-span-2 flex items-center min-w-0">
                            <span className="text-sm text-slate-600 truncate" title={session.last_door_label || 'Non définie'}>
                              {session.last_door_label || 'Non définie'}
                            </span>
                          </div>

                          <div className="col-span-4 flex items-center min-w-0">
                            <p className="text-sm text-slate-700 line-clamp-2 group-hover:text-slate-900">
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

      {/* Modal détails */}
      <Modal
        isOpen={!!openSession}
        onClose={() => setOpenSession(null)}
        title="Détails de la session"
        maxWidth="sm:max-w-4xl"
      >
        {openSession && (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Commercial</span>
                </div>
                <p className="text-slate-900 font-semibold">
                  {openSession.commercial_name || openSession.commercial_id}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Immeuble</span>
                </div>
                <p className="text-slate-900 font-semibold">
                  {openSession.building_name || 'Non défini'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Période</span>
                </div>
                <div className="text-sm text-slate-600">
                  <div>{formatDate(openSession.start_time)}</div>
                  <div>→ {formatDate(openSession.end_time)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Durée</span>
                </div>
                <Badge variant="secondary" className="font-semibold">
                  {formatDuration(openSession.duration_seconds)}
                </Badge>
              </div>

              {openSession.last_door_label && (
                <div className="space-y-3 col-span-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Dernière porte visitée</span>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {openSession.last_door_label}
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pb-4 border-b">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(openSession.full_transcript)}
                className="gap-2"
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
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900">Transcription complète</h4>
              <div className="max-h-[60vh] overflow-y-auto border rounded-lg bg-white">
                <pre className="whitespace-pre-wrap text-sm p-6 leading-relaxed text-slate-700">
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