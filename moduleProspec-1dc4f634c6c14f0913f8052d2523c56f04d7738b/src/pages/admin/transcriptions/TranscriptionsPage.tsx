import { useEffect, useMemo, useState } from 'react';
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
  const [liveByCommercial, setLiveByCommercial] = useState<Record<string, string>>({});
  const [doorByCommercial, setDoorByCommercial] = useState<Record<string, string | undefined>>({});
  const [allHistory, setAllHistory] = useState<TranscriptionSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [allCommercials, setAllCommercials] = useState<CommercialItem[]>([]);
  const [commercialStatus, setCommercialStatus] = useState<Record<string, any>>({});
  const [query, setQuery] = useState('');
  const [selectedCommercialId, setSelectedCommercialId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<TranscriptionSession[]>([]);
  const [openSession, setOpenSession] = useState<TranscriptionSession | null>(null);
  
  // Filtres pour l'historique
  const [buildingFilter, setBuildingFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [durationFilter, setDurationFilter] = useState<string>('');

  useEffect(() => {
    if (!socket) return;
    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_streaming_status');
    
    // Charger TOUT l'historique depuis la base de données
    loadHistoryFromDatabase();
    
    // Charger tous les commerciaux depuis la base de données
    loadAllCommercials();

    // Demander les statuts en temps réel
    socket.emit('request_commercials_status');

    // Rechargement automatique toutes les 60 secondes pour capturer les sauvegardes automatiques
    const intervalId = setInterval(() => {
      console.log('🔄 Rechargement automatique de l\'historique');
      loadHistoryFromDatabase();
    }, 60000); // 60 secondes

    const onUpdate = (data: LiveUpdate) => {
      setLiveByCommercial(prev => ({ ...prev, [data.commercial_id]: (prev[data.commercial_id] || '') + data.transcript }));
      if (data.door_label) {
        setDoorByCommercial(prev => ({ ...prev, [data.commercial_id]: data.door_label }));
      } else if (data.door_id) {
        setDoorByCommercial(prev => ({ ...prev, [data.commercial_id]: data.door_id }));
      }
    };
    const onHistory = (payload: { history: TranscriptionSession[] }) => {
      setAllHistory(payload.history || []);
    };
    const onCompleted = (session: TranscriptionSession) => {
      console.log('🎯 Session terminée reçue:', session.id);
      
      // Ajouter à l'historique local temporairement
      setAllHistory(prev => [session, ...prev]);
      
      // Recharger depuis la DB pour avoir la version la plus à jour
      setTimeout(() => {
        loadHistoryFromDatabase();
        socket?.emit('request_commercials_status'); // Rafraîchir les statuts aussi
      }, 1000); // Délai pour laisser le backend sauvegarder
    };

    const onCommercialsStatus = (data: { status: any[] }) => {
      const statusMap: Record<string, any> = {};
      data.status.forEach(item => {
        statusMap[item.commercial_id] = item;
      });
      setCommercialStatus(statusMap);
      console.log('👥 Statuts commerciaux mis à jour:', Object.keys(statusMap).length);
    };

    socket.on('transcription_update', onUpdate);
    socket.on('transcription_history_response', onHistory);
    socket.on('transcription_session_completed', onCompleted);
    socket.on('commercials_status_response', onCommercialsStatus);
    
    return () => {
      socket.off('transcription_update', onUpdate);
      socket.off('transcription_history_response', onHistory);
      socket.off('transcription_session_completed', onCompleted);
      socket.off('commercials_status_response', onCommercialsStatus);
      socket.emit('leaveRoom', 'audio-streaming');
      clearInterval(intervalId); // Nettoyer l'interval
    };
  }, [socket, selectedCommercialId]);

  const commercials: CommercialItem[] = useMemo(() => {
    const map = new Map<string, CommercialItem>();
    
    // D'abord, charger TOUS les commerciaux de la base de données avec leurs statistiques
    for (const commercial of allCommercials) {
      map.set(commercial.id, {
        id: commercial.id,
        name: commercial.name,
        sessionsCount: commercial.sessionsCount,
        lastTime: commercial.lastTime
      });
    }
    
    // Ensuite, traiter TOUT l'historique de la base de données pour compléter les données manquantes
    for (const s of allHistory) {
      if (!map.has(s.commercial_id)) {
        // Améliorer l'affichage du nom (prénom nom ou nom complet)
        let displayName = s.commercial_name || s.commercial_id;
        if (s.commercial_name && s.commercial_name !== s.commercial_id && !s.commercial_name.startsWith('Commercial ')) {
          // Si le nom contient des espaces, c'est probablement "Prénom Nom"
          const nameParts = s.commercial_name.split(' ');
          if (nameParts.length >= 2) {
            displayName = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
          } else {
            displayName = s.commercial_name;
          }
        }
        
        const item = map.get(s.commercial_id) || { 
          id: s.commercial_id, 
          name: displayName, 
          sessionsCount: 0, 
          lastTime: 0 
        };
        item.sessionsCount += 1;
        item.lastTime = Math.max(item.lastTime, new Date(s.start_time).getTime());
        map.set(s.commercial_id, item);
      }
    }
    
    // Ensuite, ajouter les commerciaux actuellement en live (s'ils ne sont pas déjà dans la DB)
    Object.keys(liveByCommercial).forEach(cid => {
      if (!map.has(cid)) {
        map.set(cid, { 
          id: cid, 
          name: `Commercial ${cid}`, 
          sessionsCount: 0, 
          lastTime: Date.now() 
        });
      } else {
        // Mettre à jour le lastTime pour montrer qu'il est actif maintenant
        const item = map.get(cid)!;
        item.lastTime = Math.max(item.lastTime, Date.now());
      }
    });

    // Ajouter les informations de statut en temps réel
    map.forEach((item, commercialId) => {
      const status = commercialStatus[commercialId];
      if (status) {
        item.isOnline = status.isOnline;
        item.isTranscribing = status.isTranscribing;
        item.lastSeen = status.lastSeen;
        item.currentSession = status.currentSession;
      }
    });
    
    let items = Array.from(map.values());
    if (query) items = items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()) || i.id.includes(query));
    items.sort((a, b) => b.lastTime - a.lastTime);
    return items;
  }, [allCommercials, allHistory, liveByCommercial, commercialStatus, query]);

  // Derive sessions for the selected commercial from the database history
  useEffect(() => {
    if (!selectedCommercialId) {
      setSessions([]);
      return;
    }
    setLoadingHistory(true);
    
    // Filtrer toutes les sessions de ce commercial depuis l'historique DB
    const list = allHistory.filter(s => s.commercial_id === selectedCommercialId);
    
    // Trier par date de début (plus récent en premier)
    const sortedList = list.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    
    setSessions(sortedList);
    setLoadingHistory(false);
    
    console.log(`📊 Sessions pour ${selectedCommercialId}:`, sortedList.length, 'sessions trouvées');
  }, [selectedCommercialId, allHistory]);

  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];
    
    // Filtre par immeuble
    if (buildingFilter && buildingFilter !== 'all') {
      filtered = filtered.filter(s => s.building_name === buildingFilter);
    }
    
    // Filtre par date (dernières 24h, 7 jours, 30 jours)
    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (dateFilter) {
        case '24h':
          cutoff.setHours(now.getHours() - 24);
          break;
        case '7d':
          cutoff.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoff.setDate(now.getDate() - 30);
          break;
      }
      
      filtered = filtered.filter(s => new Date(s.start_time) >= cutoff);
    }
    
    // Filtre par durée
    if (durationFilter && durationFilter !== 'all') {
      switch (durationFilter) {
        case 'short':
          filtered = filtered.filter(s => s.duration_seconds < 60);
          break;
        case 'medium':
          filtered = filtered.filter(s => s.duration_seconds >= 60 && s.duration_seconds < 300);
          break;
        case 'long':
          filtered = filtered.filter(s => s.duration_seconds >= 300);
          break;
      }
    }
    
    return filtered.sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [sessions, buildingFilter, dateFilter, durationFilter]);

  // Options uniques pour les filtres
  const uniqueBuildings = useMemo(() => {
    const buildings = new Set<string>();
    sessions.forEach(s => {
      if (s.building_name) buildings.add(s.building_name);
    });
    return Array.from(buildings).sort();
  }, [sessions]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  const selectedLive = selectedCommercialId ? liveByCommercial[selectedCommercialId] : '';
  const selectedDoor = selectedCommercialId ? doorByCommercial[selectedCommercialId] : undefined;

  const copyText = (text: string) => navigator.clipboard.writeText(text).catch(() => {});
  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  // Charger l'historique complet depuis la base de données
  const loadHistoryFromDatabase = async () => {
    setLoadingHistory(true);
    try {
      const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
      const API_PORT = import.meta.env.VITE_API_PORT || '3000';
      const response = await fetch(`https://${SERVER_HOST}:${API_PORT}/api/transcription-history?limit=1000`);
      
      if (response.ok) {
        const data = await response.json();
        const history = data.history || [];
        console.log('📚 Historique chargé depuis la DB:', history.length, 'sessions');
        setAllHistory(history);
      } else {
        console.error('❌ Erreur chargement historique DB:', response.status);
        // Fallback sur WebSocket
        socket?.emit('request_transcription_history');
      }
    } catch (error) {
      console.error('❌ Erreur chargement historique DB:', error);
      // Fallback sur WebSocket
      socket?.emit('request_transcription_history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Charger tous les commerciaux depuis la base de données
  const loadAllCommercials = async () => {
    try {
      const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
      const API_PORT = import.meta.env.VITE_API_PORT || '3000';
      const response = await fetch(`https://${SERVER_HOST}:${API_PORT}/api/transcription-history/commercials`);
      
      if (response.ok) {
        const data = await response.json();
        const commercials = data.commercials || [];
        console.log('👥 Commerciaux chargés depuis la DB:', commercials.length, 'commerciaux');
        setAllCommercials(commercials);
      } else {
        console.error('❌ Erreur chargement commerciaux DB:', response.status);
      }
    } catch (error) {
      console.error('❌ Erreur chargement commerciaux DB:', error);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6 bg-gradient-to-br from-slate-50 to-white">
      {/* En-tête avec titre et actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Transcriptions</h1>
          <p className="text-slate-600 mt-1">Suivi en temps réel et historique des sessions commerciales</p>
        </div>
        <Button variant="outline" onClick={loadHistoryFromDatabase} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Colonne des commerciaux - plus compacte */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3">
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-slate-600" />
                Commerciaux
              </CardTitle>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                <Input className="pl-9" placeholder="Rechercher un commercial..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[70vh]">
                {commercials.length === 0 ? (
                  <div className="text-slate-500 text-sm text-center py-8">Aucun commercial trouvé</div>
                ) : (
                  <div className="space-y-1">
                    {commercials.map(c => {
                      const isLive = liveByCommercial[c.id];
                      const isOnline = c.isOnline || false;
                      const isTranscribing = c.isTranscribing || false;
                      
                      // Déterminer le statut principal
                      let statusColor = 'bg-gray-400'; // Hors ligne par défaut
                      
                      if (isTranscribing) {
                        statusColor = 'bg-red-500'; // Rouge pour transcription en cours
                      } else if (isLive || isOnline) {
                        statusColor = 'bg-green-500'; // Vert pour en ligne
                      }
                      
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCommercialId(c.id)}
                          className={`w-full text-left rounded-lg p-3 transition-all ${
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
                                <div className="text-xs text-slate-500">{c.sessionsCount} sessions</div>
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
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-6">
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
                  {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
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
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-slate-500">Aucune session trouvée avec les filtres actuels</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* En-tête de la liste */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50 rounded-lg text-xs font-medium text-slate-600 uppercase tracking-wide">
                    <div className="col-span-2">Date & Heure</div>
                    <div className="col-span-3">Immeuble</div>
                    <div className="col-span-1">Durée</div>
                    <div className="col-span-2">Porte</div>
                    <div className="col-span-4">Transcription</div>
                  </div>
                  
                  {/* Liste des sessions */}
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-1">
                      {filteredSessions.map(session => (
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

      {/* Modal améliorée pour les détails de session */}
      <Modal 
        isOpen={!!openSession} 
        onClose={() => setOpenSession(null)} 
        title="Détails de la session" 
        maxWidth="sm:max-w-4xl"
      >
        {openSession && (
          <div className="space-y-6 p-6">
            {/* Informations de la session */}
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
            
            {/* Actions */}
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
                onClick={() => downloadText(
                  `transcription_${openSession.commercial_name || openSession.commercial_id}_${new Date(openSession.start_time).toISOString().split('T')[0]}.txt`, 
                  openSession.full_transcript
                )}
                className="gap-2"
              >
                <Download className="h-4 w-4" /> 
                Télécharger
              </Button>
            </div>
            
            {/* Transcription */}
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
