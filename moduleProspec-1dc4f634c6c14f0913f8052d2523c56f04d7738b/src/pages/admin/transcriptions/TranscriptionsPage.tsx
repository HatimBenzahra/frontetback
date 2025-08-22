import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { ScrollArea } from '@/components/ui-admin/scroll-area';
import { Modal } from '@/components/ui-admin/Modal';
import { Badge } from '@/components/ui-admin/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { RefreshCw, Search, Copy, Download, Calendar, Clock, Building2, User, Filter, Mic, MicOff, Activity, FileText } from 'lucide-react';
import { type TranscriptionSession, transcriptionHistoryService } from '@/services/transcriptionHistory.service';
import { immeubleService, type ImmeubleDetailsFromApi } from '@/services/immeuble.service';
import { API_BASE_URL } from '@/config';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';


type LiveUpdate = {
  
  commercial_id: string;
  transcript: string;
  is_final: boolean;
  timestamp: string;
  door_id?: string;
  door_label?: string;
};

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
  const [liveCommittedByCommercial, setLiveCommittedByCommercial] = useState<Record<string, string>>({});
  const [livePartialByCommercial, setLivePartialByCommercial] = useState<Record<string, string>>({});
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
  const [openSessionBuilding, setOpenSessionBuilding] = useState<ImmeubleDetailsFromApi | null>(null);
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const [buildingDetails, setBuildingDetails] = useState<Record<string, ImmeubleDetailsFromApi>>({});

  // Filtres pour l'historique
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');

  const [liveMaxChars] = useState<number>(8000);

  // Debounce partiels
  const partialTimerRef = useRef<Record<string, number>>({});

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

  // DB: commerciaux
  const loadAllCommercials = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}/api/transcription-history/commercials`);
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

  // DB: historique du commercial sélectionné
  const loadHistoryForSelected = useCallback(async () => {
    if (!selectedCommercialId) { setSessions([]); return; }
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ commercial_id: selectedCommercialId });
      if (buildingFilter !== 'all') params.set('building', buildingFilter);
      if (dateFilter !== 'all') params.set('since', dateFilter);
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

  // Charger les détails des immeubles pour toutes les sessions
  useEffect(() => {
    const loadBuildingDetails = async () => {
      const buildingIds = sessions
        .map(s => s.building_id)
        .filter((id): id is string => !!id && !buildingDetails[id]);
      
      if (buildingIds.length === 0) return;

      const promises = buildingIds.map(async (buildingId) => {
        try {
          const building = await immeubleService.getImmeubleDetails(buildingId);
          return { buildingId, building };
        } catch {
          return { buildingId, building: null };
        }
      });

      const results = await Promise.all(promises);
      const newBuildingDetails = { ...buildingDetails };
      results.forEach(({ buildingId, building }) => {
        if (building) {
          newBuildingDetails[buildingId] = building;
        }
      });
      setBuildingDetails(newBuildingDetails);
    };

    loadBuildingDetails();
  }, [sessions, buildingDetails]);

  // --- helper: obtenir le texte live combiné pour un commercial ---
  const getLiveCombinedFor = useCallback((cid: string) => {
    const committed = liveCommittedByCommercial[cid] || '';
    const partial = livePartialByCommercial[cid] || '';
    return (committed + (partial ? (committed ? ' ' : '') + partial : '')).trim();
  }, [liveCommittedByCommercial, livePartialByCommercial]);

  // --- helper: vider le live d'un commercial ---
  const clearLiveBuffersFor = useCallback((cid: string) => {
    // purge committed & partial
    setLiveCommittedByCommercial(prev => ({ ...prev, [cid]: '' }));
    setLivePartialByCommercial(prev => ({ ...prev, [cid]: '' }));
    // annule timer partiel éventuel
    const t = partialTimerRef.current[cid];
    if (t) {
      window.clearTimeout(t);
      delete partialTimerRef.current[cid];
    }
  }, []);

  // WebSocket: listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_commercials_status');

    const onUpdate = async (data: LiveUpdate) => {
      const cid = data.commercial_id;
      let chunk = data.transcript || '';

      if (data.door_label || data.door_id) {
        setDoorByCommercial(prev => ({ ...prev, [cid]: data.door_label ?? data.door_id }));
      }

      // Traitement centralisé via API backend
      try {
        const response = await fetch(`${BASE}/api/transcription-history/process-chunk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunk,
            committed: liveCommittedByCommercial[cid] || '',
            isFinal: data.is_final,
            maxChars: liveMaxChars
          })
        });

        if (response.ok) {
          const result = await response.json();
          chunk = result.processedChunk;

          if (data.is_final) {
            setLiveCommittedByCommercial(prev => ({ ...prev, [cid]: result.newCommitted }));
            setLivePartialByCommercial(prev => ({ ...prev, [cid]: '' }));

            const t = partialTimerRef.current[cid];
            if (t) {
              window.clearTimeout(t);
              delete partialTimerRef.current[cid];
            }
          } else {
            const run = () => {
              setLivePartialByCommercial(prev => ({ ...prev, [cid]: chunk }));
            };
            const prevTimer = partialTimerRef.current[cid];
            if (prevTimer) window.clearTimeout(prevTimer);
            partialTimerRef.current[cid] = window.setTimeout(run, 150);
          }
        } else {
          // Fallback: traitement minimal côté client
          chunk = chunk.replace(/\s+/g, ' ').trim();
          if (data.is_final) {
            setLiveCommittedByCommercial(prev => {
              const merged = (prev[cid] || '') + (prev[cid] ? ' ' : '') + chunk;
              const clipped = merged.length > liveMaxChars ? merged.slice(merged.length - liveMaxChars) : merged;
              return { ...prev, [cid]: clipped };
            });
            setLivePartialByCommercial(prev => ({ ...prev, [cid]: '' }));
          } else {
            const run = () => setLivePartialByCommercial(prev => ({ ...prev, [cid]: chunk }));
            const prevTimer = partialTimerRef.current[cid];
            if (prevTimer) window.clearTimeout(prevTimer);
            partialTimerRef.current[cid] = window.setTimeout(run, 150);
          }
        }
      } catch (error) {
        console.error('Erreur traitement chunk:', error);
        // Fallback simple en cas d'erreur API
        chunk = chunk.replace(/\s+/g, ' ').trim();
        if (data.is_final) {
          setLiveCommittedByCommercial(prev => {
            const merged = (prev[cid] || '') + (prev[cid] ? ' ' : '') + chunk;
            return { ...prev, [cid]: merged };
          });
        }
      }
    };

    const onCommercialsStatus = (data: { status: any[] }) => {
      const statusMap: Record<string, any> = {};
      data.status.forEach(item => { statusMap[item.commercial_id] = item; });
      setCommercialStatus(statusMap);
    };

    // ⬇️ Quand une session se termine: récupérer le texte partiel, synchroniser et vider le live
    // CORRECTION: Cette fonction récupère maintenant le texte partiel avant de vider les buffers
    // pour éviter la perte du dernier segment de transcription
    const onCompleted = async (session: TranscriptionSession) => {
      const cid = session.commercial_id as unknown as string;
      
      // 1. Récupérer le texte live complet (committed + partial) avant de vider
      const fullLocal = getLiveCombinedFor(cid);
      console.log('Session terminée, texte local complet:', fullLocal.length, 'caractères');

      // 2. Recharger l'historique pour obtenir la version serveur
      if (cid === selectedCommercialId) {
        await loadHistoryForSelected();
      }

      // 3. Retrouver la session côté client après reload
      const serverSession = sessions.find(s => s.id === session.id);
      const serverText = serverSession?.full_transcript || '';

      // 4. Si le serveur a moins de texte, envoyer notre version complète
      if (fullLocal.length > serverText.length + 10) {
        console.log('Synchronisation nécessaire - Local:', fullLocal.length, 'Serveur:', serverText.length);
        const synced = await transcriptionHistoryService.patchSessionIfShorter(session.id, fullLocal);
        if (synced && cid === selectedCommercialId) {
          // Recharger l'historique après synchronisation
          await loadHistoryForSelected();
        }
      } else {
        console.log('Pas de synchronisation nécessaire - Local:', fullLocal.length, 'Serveur:', serverText.length);
      }

      // 5. Vider les buffers live MAINTENANT uniquement
      clearLiveBuffersFor(cid);

      // 6. Mettre à jour le statut des commerciaux
      socket.emit('request_commercials_status');
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
  }, [socket, selectedCommercialId, loadHistoryForSelected, liveMaxChars, clearLiveBuffersFor, getLiveCombinedFor, sessions]);

  // Liste commerciaux fusionnée
  const commercials: CommercialItem[] = useMemo(() => {
    const map = new Map<string, CommercialItem>();
    for (const c of allCommercials) map.set(c.id, { ...c });

    Object.keys(liveCommittedByCommercial).forEach(cid => {
      if (!map.has(cid)) {
        map.set(cid, { id: cid, name: `Commercial ${cid}`, sessionsCount: 0, lastTime: Date.now() });
      } else {
        const item = map.get(cid)!;
        item.lastTime = Math.max(item.lastTime ?? 0, Date.now());
      }
    });
    Object.keys(livePartialByCommercial).forEach(cid => {
      if (!map.has(cid)) {
        map.set(cid, { id: cid, name: `Commercial ${cid}`, sessionsCount: 0, lastTime: Date.now() });
      } else {
        const item = map.get(cid)!;
        item.lastTime = Math.max(item.lastTime ?? 0, Date.now());
      }
    });

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
  }, [allCommercials, liveCommittedByCommercial, livePartialByCommercial, commercialStatus, query]);

  // Dérivés UI
  const uniqueBuildings = useMemo(() => {
    const buildings = new Set<string>();
    sessions.forEach(s => {
      if (s.building_id && buildingDetails[s.building_id]) {
        const building = buildingDetails[s.building_id];
        buildings.add(`${building.adresse}, ${building.codePostal} ${building.ville}`);
      } else if (s.building_name) {
        buildings.add(s.building_name);
      }
    });
    return Array.from(buildings).sort();
  }, [sessions, buildingDetails]);

  const selectedCommitted = selectedCommercialId ? (liveCommittedByCommercial[selectedCommercialId] || '') : '';
  const selectedPartial = selectedCommercialId ? (livePartialByCommercial[selectedCommercialId] || '') : '';
  const selectedLive = (selectedCommitted + (selectedPartial ? (selectedCommitted ? ' ' : '') + selectedPartial : '')).trim();
  const selectedDoor = selectedCommercialId ? doorByCommercial[selectedCommercialId] : undefined;

  const handleSelectCommercial = (id: string) => {
    setSelectedCommercialId(id);
    setLivePartialByCommercial(prev => ({ ...prev, [id]: '' }));
  };

  // Fonction pour rendre une carte commercial
  const renderCommercialCard = (c: CommercialItem, isTranscribing: boolean) => {
    const hasCommitted = !!liveCommittedByCommercial[c.id];
    const hasPartial = !!livePartialByCommercial[c.id];
    const isLive = hasCommitted || hasPartial;
    
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
        className={`w-full text-left rounded-lg p-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-2 ${
          selectedCommercialId === c.id
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-lg'
            : `hover:${statusBg} ${borderColor} hover:border-opacity-60`
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="relative mt-1">
              <div className={`w-3 h-3 ${statusColor} rounded-full flex-shrink-0 ${isTranscribing || isLive ? 'animate-pulse' : ''}`} />
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
              {/* Aperçu du live text si disponible */}
              {isLive && (liveCommittedByCommercial[c.id] || livePartialByCommercial[c.id]) && (
                <div className="mt-2 p-2 bg-white/60 rounded text-xs text-gray-600 line-clamp-2 border border-gray-200">
                  {((liveCommittedByCommercial[c.id] || '') + ' ' + (livePartialByCommercial[c.id] || '')).trim().slice(0, 100)}...
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 ml-2">
            {isTranscribing && (
              <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs px-2 py-0.5">
                <Mic className="h-3 w-3 mr-1" />
                En cours
              </Badge>
            )}
            {isLive && !isTranscribing && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
            {!isLive && !isTranscribing && c.isOnline && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs px-2 py-0.5">
                En ligne
              </Badge>
            )}
            {!c.isOnline && !isLive && !isTranscribing && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5">
                <MicOff className="h-3 w-3 mr-1" />
                Hors ligne
              </Badge>
            )}
            {selectedCommercialId === c.id && (
              <Badge variant="default" className="bg-blue-600 text-white text-xs px-2 py-0.5">
                Sélectionné
              </Badge>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transcriptions</h1>
            <p className="text-gray-600 mt-1">Gestion et consultation des sessions de transcription</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={loadAllCommercials}
              variant="outline"
              className="gap-2 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
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

        {/* Sections Live et Historique - Affichage conditionnel */}
        {selectedCommercialId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Transcription - Seulement si le commercial est actif */}
            {(() => {
              const selectedCommercial = commercials.find(c => c.id === selectedCommercialId);
              const hasCommitted = !!liveCommittedByCommercial[selectedCommercialId];
              const hasPartial = !!livePartialByCommercial[selectedCommercialId];
              const isLive = hasCommitted || hasPartial;
              const isActive = selectedCommercial?.isTranscribing || selectedCommercial?.isOnline || isLive;
              
              return isActive && (
                <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm h-[500px]">
                  <CardHeader className="pb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100/50">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      </div>
                      Live - {selectedCommercial?.name || selectedCommercialId}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 h-[calc(100%-80px)]">
                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border overflow-hidden m-4 h-[calc(100%-32px)]">
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
              );
            })()}

            {/* Historique - Toujours affiché quand un commercial est sélectionné */}
            <Card className={`shadow-xl border-0 bg-white/95 backdrop-blur-sm h-[500px] ${
              !(() => {
                const selectedCommercial = commercials.find(c => c.id === selectedCommercialId);
                const hasCommitted = !!liveCommittedByCommercial[selectedCommercialId];
                const hasPartial = !!livePartialByCommercial[selectedCommercialId];
                const isLive = hasCommitted || hasPartial;
                return selectedCommercial?.isTranscribing || selectedCommercial?.isOnline || isLive;
              })() ? 'lg:col-span-2' : ''
            }`}>
              <CardHeader className="pb-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100/50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Calendar className="h-4 w-4 text-purple-600" />
                    </div>
                    Historique - {commercials.find(c => c.id === selectedCommercialId)?.name || selectedCommercialId}
                  </CardTitle>
                  <div className="text-sm text-gray-600 bg-white/80 px-3 py-1 rounded-full">
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''}
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
                        <SelectItem key={building} value={building}>{building}</SelectItem>
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

              <CardContent className="p-0 flex-1 min-h-0 h-[calc(100%-140px)]">
                {loadingHistory ? (
                    <AdminPageSkeleton hasTable tableRows={3} className="mt-4" />
                ) : sessions.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="h-10 w-10 text-gray-400" />
                    </div>
                    <div className="text-gray-500 font-medium">Aucune session trouvée</div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 min-h-0 px-4 pb-4">
                      <ScrollArea className="h-full custom-scroll-area">
                        <div className="space-y-2 pr-4">
                          {sessions.map(session => {
                            const displayTranscript = session.full_transcript || '';

                            return (
                              <div
                                key={session.id}
                                className="p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl cursor-pointer transition-all duration-300 group border border-transparent hover:border-blue-200 hover:shadow-md"
                                onClick={() => {
                                  setOpenSession(session);
                                  // Charger les détails de l'immeuble si building_id existe
                                  if (session.building_id) {
                                    setLoadingBuilding(true);
                                    immeubleService.getImmeubleDetails(session.building_id)
                                      .then(building => setOpenSessionBuilding(building))
                                      .catch(() => setOpenSessionBuilding(null))
                                      .finally(() => setLoadingBuilding(false));
                                  } else {
                                    setOpenSessionBuilding(null);
                                  }
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                                    <Clock className="h-3 w-3 text-blue-600" />
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
                                        {session.building_id && buildingDetails[session.building_id] ? (
                                          `${buildingDetails[session.building_id].adresse}, ${buildingDetails[session.building_id].codePostal} ${buildingDetails[session.building_id].ville}`
                                        ) : (
                                          session.building_name || 'Non défini'
                                        )}
                                      </span>
                                      {session.visited_doors && session.visited_doors.length > 0 && (
                                        <span className="ml-2">- Portes: {session.visited_doors.join(', ')}</span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700 line-clamp-3 group-hover:text-gray-900 transition-colors">
                                      {displayTranscript || 'Aucune transcription'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedCommercialId && (
          <div className="text-center py-20">
            <div className="p-6 bg-gray-100 rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center">
              <User className="h-16 w-16 text-gray-400" />
            </div>
            <div className="text-gray-500 font-medium text-lg mb-2">Sélectionnez un commercial</div>
            <div className="text-sm text-gray-400">Cliquez sur un commercial ci-dessus pour voir ses transcriptions en temps réel et son historique</div>
          </div>
        )}
      </div>

      {/* Modal détails */}
      <Modal
        isOpen={!!openSession}
        onClose={() => {
          setOpenSession(null);
          setOpenSessionBuilding(null);
        }}
        title="Détails de la session de transcription"
        maxWidth="max-w-4xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        {openSession && (
          <div className="space-y-6">
            <div className="mb-4 text-sm text-muted-foreground">
              Détails complets de la session de transcription incluant le commercial, la localisation, la durée et le contenu.
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    Informations générales
                  </CardTitle>
                  <CardDescription>Commercial et données de session.</CardDescription>
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
                  <CardDescription>Adresse et portes visitées.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Adresse de l'immeuble</span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {loadingBuilding ? (
                        'Chargement...'
                      ) : openSessionBuilding ? (
                        `${openSessionBuilding.adresse}, ${openSessionBuilding.codePostal} ${openSessionBuilding.ville}`
                      ) : (
                        openSession.building_name || 'Non défini'
                      )}
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600" />
                  Transcription complète
                </CardTitle>
                <CardDescription>Contenu intégral de la session de transcription.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(openSession.full_transcript || '')}
                    className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    Copier
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
                    className="gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                </div>
                
                <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded-lg bg-gray-50">
                  <pre className="whitespace-pre-wrap text-sm p-4 leading-relaxed text-gray-700 font-mono">
                    {openSession.full_transcript || 'Aucune transcription disponible'}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TranscriptionsPage;