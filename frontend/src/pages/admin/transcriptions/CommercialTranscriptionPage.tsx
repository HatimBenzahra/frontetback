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

const CommercialTranscriptionPage = () => {
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
  const [openSessionBuilding, setOpenSessionBuilding] = useState<ImmeubleDetailsFromApi | null>(null);
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const [buildingDetails, setBuildingDetails] = useState<Record<string, ImmeubleDetailsFromApi>>({});

  // Filtres pour l'historique
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');

  // États pour le loading IA
  const [aiProcessingSessions, setAiProcessingSessions] = useState<Set<string>>(new Set());

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

  // Fonction pour gérer le loading IA
  const setAiProcessing = (sessionId: string, isProcessing: boolean) => {
    setAiProcessingSessions(prev => {
      const newSet = new Set(prev);
      if (isProcessing) {
        newSet.add(sessionId);
      } else {
        newSet.delete(sessionId);
      }
      return newSet;
    });
  };

  // Charger les informations du commercial
  const loadCommercialInfo = useCallback(async () => {
    if (!commercialId) return;
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
        const commercial = data.commercials?.find((c: any) => c.id === commercialId);
        setCommercialInfo(commercial || { id: commercialId, name: `Commercial ${commercialId}` });
      }
    } catch (error) {
      console.error('Erreur chargement commercial:', error);
      setCommercialInfo({ id: commercialId, name: `Commercial ${commercialId}` });
    }
  }, [commercialId, BASE]);

  // Charger l'historique du commercial
  const loadHistory = useCallback(async () => {
    if (!commercialId) { setSessions([]); return; }
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ commercial_id: commercialId });
      if (buildingFilter !== 'all') params.set('building', buildingFilter);
      if (dateFilter !== 'all') params.set('since', dateFilter);
      if (durationFilter !== 'all') params.set('duration', durationFilter);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${BASE}/api/transcription-history?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (response.ok) {
        const data = await response.json();
        const rawList: TranscriptionSession[] = (Array.isArray(data) ? data : data.history || data.sessions || []).sort(
          (a: TranscriptionSession, b: TranscriptionSession) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
        
        // Dédupliquer les sessions en gardant la plus récente (avec traitement IA si disponible)
        const deduplicatedSessions = rawList.reduce((acc, current) => {
          // Créer une clé unique basée sur commercial_id, building_id et timestamp (à la minute près)
          const sessionKey = `${current.commercial_id}_${current.building_id || 'no-building'}_${new Date(current.start_time).toISOString().substring(0, 16)}`;
          
          const existing = acc.find(session => {
            const existingKey = `${session.commercial_id}_${session.building_id || 'no-building'}_${new Date(session.start_time).toISOString().substring(0, 16)}`;
            return existingKey === sessionKey;
          });
          
          if (!existing) {
            acc.push(current);
          } else {
            // Si on trouve une session existante, garder celle qui a le traitement IA (si disponible)
            const currentHasAI = current.full_transcript?.includes('**Commercial :**');
            const existingHasAI = existing.full_transcript?.includes('**Commercial :**');
            
            if (currentHasAI && !existingHasAI) {
              // Remplacer par la version avec IA
              const index = acc.indexOf(existing);
              acc[index] = current;
              console.log('🔄 Session remplacée par version IA:', current.id);
            } else if (!currentHasAI && existingHasAI) {
              // Garder la version avec IA existante
              console.log('🔄 Session gardée (version IA existante):', existing.id);
            } else {
              // Si les deux ont ou n'ont pas l'IA, garder la plus récente
              if (new Date(current.start_time) > new Date(existing.start_time)) {
                const index = acc.indexOf(existing);
                acc[index] = current;
                console.log('🔄 Session remplacée par version plus récente:', current.id);
              }
            }
          }
          
          return acc;
        }, [] as TranscriptionSession[]);
        
        console.log('Sessions après déduplication:', deduplicatedSessions.length, 'sur', rawList.length, 'originales');
        setSessions(deduplicatedSessions);
        // Reset à la première page quand on charge de nouvelles données
        setCurrentPage(1);
      } else {
        setSessions([]);
        console.error('Erreur chargement historique:', response.status);
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      setSessions([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [commercialId, buildingFilter, dateFilter, durationFilter, BASE]);

  useEffect(() => {
    loadCommercialInfo();
    loadHistory();
    
    // Animation d'entrée de la page
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [loadCommercialInfo, loadHistory]);

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
          setOpenSessionBuilding(null);
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

  // Charger les détails des immeubles
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

  // WebSocket listeners
  useEffect(() => {
    if (!socket || !commercialId) return;

    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_commercials_status');

    const onUpdate = async (data: LiveUpdate) => {
      if (data.commercial_id !== commercialId) return;

      let chunk = data.transcript || '';

      if (data.door_label || data.door_id) {
        setCurrentDoor(data.door_label ?? data.door_id ?? '');
      }

      // Traitement centralisé via API backend
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${BASE}/api/transcription-history/process-chunk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
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
      const status = data.status.find(item => item.commercial_id === commercialId);
      setCommercialStatus(status);
    };

    const onCompleted = async (session: TranscriptionSession) => {
      if (session.commercial_id !== commercialId) return;
      
      const fullLocal = (liveCommitted + (livePartial ? (liveCommitted ? ' ' : '') + livePartial : '')).trim();
      console.log('Session terminée, texte local complet:', fullLocal.length, 'caractères');

      setAiProcessing(session.id, true);
      console.log('🤖 Loading IA activé pour session:', session.id);

      await loadHistory();

      const serverSession = sessions.find(s => s.id === session.id);
      const serverText = serverSession?.full_transcript || '';

      if (fullLocal.length > serverText.length + 10) {
        console.log('Synchronisation nécessaire - Local:', fullLocal.length, 'Serveur:', serverText.length);
        const synced = await transcriptionHistoryService.patchSessionIfShorter(session.id, fullLocal);
        if (synced) {
          await loadHistory();
        }
      } else {
        console.log('Pas de synchronisation nécessaire - Local:', fullLocal.length, 'Serveur:', serverText.length);
      }

      // Vider les buffers live
      setLiveCommitted('');
      setLivePartial('');
      setCurrentDoor('');

      if (partialTimerRef.current) {
        window.clearTimeout(partialTimerRef.current);
        partialTimerRef.current = null;
      }

      socket.emit('request_commercials_status');
    };

    const onSessionUpdated = async (updatedSession: TranscriptionSession) => {
      if (updatedSession.commercial_id !== commercialId) return;
      
      console.log('📝 Session mise à jour reçue:', updatedSession.id, 'transcript length:', updatedSession.full_transcript?.length || 0);
      
      // Mettre à jour directement la session dans l'état local
      setSessions(prevSessions => {
        const sessionIndex = prevSessions.findIndex(s => s.id === updatedSession.id);
        if (sessionIndex !== -1) {
          // Mettre à jour la session existante
          const newSessions = [...prevSessions];
          newSessions[sessionIndex] = updatedSession;
          console.log('✅ Session mise à jour dans l\'état local:', updatedSession.id);
          return newSessions;
        } else {
          // Si la session n'existe pas encore, l'ajouter au début
          console.log('➕ Nouvelle session ajoutée à l\'état local:', updatedSession.id);
          return [updatedSession, ...prevSessions];
        }
      });
      
      // Si la session était en traitement IA et qu'elle a maintenant du contenu traité, arrêter le loading
      if (aiProcessingSessions.has(updatedSession.id)) {
        const hasAiProcessing = updatedSession.full_transcript?.includes('**Commercial :**') || 
                               updatedSession.full_transcript?.includes('**Prospect :**');
        
        if (hasAiProcessing && updatedSession.full_transcript && updatedSession.full_transcript.length > 100) {
          console.log('✅ Traitement IA terminé détecté via WebSocket pour session:', updatedSession.id);
          setAiProcessing(updatedSession.id, false);
        }
      }
    };

    socket.on('transcription_update', onUpdate);
    socket.on('commercials_status_response', onCommercialsStatus);
    socket.on('transcription_session_completed', onCompleted);
    socket.on('transcription_session_updated', onSessionUpdated);

    return () => {
      socket.off('transcription_update', onUpdate);
      socket.off('commercials_status_response', onCommercialsStatus);
      socket.off('transcription_session_completed', onCompleted);
      socket.off('transcription_session_updated', onSessionUpdated);
      socket.emit('leaveRoom', 'audio-streaming');
    };
  }, [socket, commercialId, liveCommitted, liveMaxChars, loadHistory, sessions, BASE]);

  // Effet pour nettoyer le loading IA
  useEffect(() => {
    const processingSessions = Array.from(aiProcessingSessions);
    processingSessions.forEach(sessionId => {
      const session = sessions.find(s => s.id === sessionId);
      if (session && session.full_transcript && session.full_transcript.length > 0) {
        const hasAiProcessing = session.full_transcript.includes('**Commercial :**') || 
                               session.full_transcript.includes('**Prospect :**');
        
        if (hasAiProcessing) {
          console.log('✅ Traitement IA terminé détecté pour session:', sessionId);
          setAiProcessing(sessionId, false);
        } else {
          // Vérifier si la session a été mise à jour avec du contenu traité
          // Si le texte a changé et n'est plus en cours de traitement, arrêter le loading
          const isStillProcessing = session.full_transcript.includes('Traitement IA en cours') ||
                                   session.full_transcript.length < 50; // Texte trop court = encore en traitement
          
          if (!isStillProcessing && session.full_transcript.length > 0) {
            console.log('✅ Session mise à jour détectée, arrêt du loading IA:', sessionId);
            setAiProcessing(sessionId, false);
          } else {
            console.log('⏳ Session en cours de traitement IA:', sessionId);
          }
        }
      }
    });
  }, [sessions, aiProcessingSessions]);

  // Fonction de rafraîchissement
  const refreshAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Rafraîchissement complet des données...');
      
      await loadCommercialInfo();
      await loadHistory();
      
      if (socket) {
        socket.emit('request_commercials_status');
      }
      
      console.log('✅ Rafraîchissement terminé');
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCommercialInfo, loadHistory, socket]);

  // Polling pour recharger l'historique
  useEffect(() => {
    if (aiProcessingSessions.size > 0) {
      const interval = setInterval(() => {
        console.log('🔄 Polling pour sessions en traitement IA...');
        loadHistory();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [aiProcessingSessions.size, loadHistory]);

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

  const selectedLive = (liveCommitted + (livePartial ? (liveCommitted ? ' ' : '') + livePartial : '')).trim();
  const isTranscribing = commercialStatus?.isTranscribing || false;
  const isOnline = commercialStatus?.isOnline || false;

  // Calculs pour la pagination
  const totalPages = Math.ceil(sessions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSessions = sessions.slice(startIndex, endIndex);

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

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6 transition-all duration-500 ease-out ${
      isPageLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
    }`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/admin/transcriptions')}
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
              <p className="text-gray-600 mt-1">
                Transcriptions en temps réel et historique
                <span className="text-xs text-gray-400 ml-2">(Ctrl+R pour actualiser)</span>
              </p>
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
                  onClick={loadHistory}
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

          <CardContent className="p-0">
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
              <div className="flex flex-col">
                <div className="px-4 py-4">
                  <div className="space-y-2">
                    {currentSessions.map(session => {
                        const displayTranscript = session.full_transcript || '';
                        const isAiProcessing = aiProcessingSessions.has(session.id);

                        return (
                          <div
                            key={session.id}
                            className={`p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl cursor-pointer transition-all duration-300 group border border-transparent hover:border-blue-200 hover:shadow-md ${
                              isAiProcessing ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' : ''
                            }`}
                            onClick={() => {
                              setOpenSession(session);
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
                                {isAiProcessing ? (
                                  <div className="animate-spin h-3 w-3 border-2 border-orange-500 border-t-transparent rounded-full" />
                                ) : (
                                  <Clock className="h-3 w-3 text-blue-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="text-xs font-semibold text-gray-900">
                                    {formatDate(session.start_time)}
                                  </div>
                                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                                    {formatDuration(session.duration_seconds)}
                                  </Badge>
                                  {isAiProcessing && (
                                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 animate-pulse">
                                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse mr-1" />
                                      IA en cours...
                                    </Badge>
                                  )}
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
                                {isAiProcessing ? (
                                  <div className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                                    <span className="flex items-center gap-2">
                                      <span className="text-orange-600 font-medium">Traitement IA en cours...</span>
                                      <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-700 line-clamp-3 group-hover:text-gray-900 transition-colors">
                                    {displayTranscript || 'Aucune transcription'}
                                  </p>
                                )}
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
                         Affichage {startIndex + 1}-{Math.min(endIndex, sessions.length)} sur {sessions.length} sessions
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
        onClose={() => {
          setOpenSession(null);
          setOpenSessionBuilding(null);
        }}
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
    </div>
  );
};

export default CommercialTranscriptionPage;
