import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { type LayoutControls } from '@/layout/layout.types';
import PageSkeleton from '@/components/PageSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-admin/card';
import { type Porte, statusConfig, statusList, type PorteStatus } from './doors-config';
import { ArrowLeft, Building, DoorOpen, Repeat, Trash2, Plus, ChevronDown, Mic, MicOff } from 'lucide-react';
import { Modal } from '@/components/ui-admin/Modal';
import { Input } from '@/components/ui-admin/input';
import { Button } from '@/components/ui-admin/button';
import { Label } from '@/components/ui-admin/label';
import { immeubleService, type ImmeubleDetailsFromApi } from '@/services/immeuble.service';
import { porteService } from '@/services/porte.service';
import { statisticsService } from '@/services/statistics.service';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui-admin/alert-dialog";
import { useSocket } from '@/hooks/useSocket';


const ProspectingDoorsPage = () => {
    const {buildingId } = useParams<{ buildingId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const layoutControls = useOutletContext<LayoutControls>();
    const socket = useSocket(buildingId);
    // Audio streaming state
    const [isMicOn, setIsMicOn] = useState(false);
    const localStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const deepgramWsRef = useRef<WebSocket | null>(null);
    const [isDgLive, setIsDgLive] = useState(false);
    const activeDoorIdRef = useRef<string | null>(null);
    const activeDoorLabelRef = useRef<string | null>(null);
    // const [activeDoorId, setActiveDoorId] = useState<string | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    // Listener presence is intentionally not shown to the commercial

    // Join the audio-streaming room for presence and events
    useEffect(() => {
        if (!socket) return;
        socket.emit('joinRoom', 'audio-streaming');
        return () => {
            socket.emit('leaveRoom', 'audio-streaming');
        };
    }, [socket]);

    // Handle incoming WebRTC offers/ICE from listeners when mic is active
    useEffect(() => {
        if (!socket) return;

        const handleOffer = async (payload: { from_socket_id: string; sdp: string; type: string }) => {
            if (!isMicOn) return;
            try {
                if (!localStreamRef.current) return;
                const pc = new RTCPeerConnection({ iceServers: getIceServers() });
                // Send local audio
                localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
                try {
                    // Prefer lower bitrate for stability
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                    if (sender) {
                        const params = sender.getParameters();
                        params.encodings = [{ ...params.encodings?.[0], maxBitrate: 32000 }];
                        await sender.setParameters(params);
                    }
                } catch {}
                pc.onicecandidate = (event) => {
                    socket.emit('suivi:webrtc_ice_candidate', {
                        to_socket_id: payload.from_socket_id,
                        candidate: event.candidate || null,
                    });
                };
                pc.onconnectionstatechange = () => {
                    if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
                        peerConnectionsRef.current.delete(payload.from_socket_id);
                    }
                };
                await pc.setRemoteDescription({ type: payload.type as RTCSdpType, sdp: payload.sdp });
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                peerConnectionsRef.current.set(payload.from_socket_id, pc);
                socket.emit('suivi:webrtc_answer', {
                    to_socket_id: payload.from_socket_id,
                    sdp: answer.sdp,
                    type: answer.type,
                });
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        };

        const handleIce = async (payload: { from_socket_id: string; candidate: RTCIceCandidateInit | null }) => {
            const pc = peerConnectionsRef.current.get(payload.from_socket_id);
            if (!pc || !payload.candidate) return;
            try {
                await pc.addIceCandidate(payload.candidate);
            } catch (err) {
                console.error('Error adding ICE candidate:', err);
            }
        };

        const handleLeave = (payload: { from_socket_id: string }) => {
            const pc = peerConnectionsRef.current.get(payload.from_socket_id);
            if (pc) {
                try { pc.close(); } catch {}
                peerConnectionsRef.current.delete(payload.from_socket_id);
            }
        };

        socket.on('suivi:webrtc_offer', handleOffer);
        socket.on('suivi:webrtc_ice_candidate', handleIce);
        socket.on('suivi:leave', handleLeave);

        return () => {
            socket.off('suivi:webrtc_offer', handleOffer);
            socket.off('suivi:webrtc_ice_candidate', handleIce);
            socket.off('suivi:leave', handleLeave);
        };
    }, [socket, isMicOn]);

    const stopStreaming = useCallback(() => {
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        // no listener count displayed
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        // Stop media recorder and server-side transcription / Deepgram WS
        try { mediaRecorderRef.current?.stop(); } catch {}
        mediaRecorderRef.current = null;
        try { deepgramWsRef.current?.close(); } catch {}
        deepgramWsRef.current = null;
        setIsDgLive(false);
        if (socket && user?.id) {
            socket.emit('transcription_stop', { commercial_id: user.id });
        }
        if (socket && user?.id) {
            socket.emit('stop_streaming', { commercial_id: user.id });
        }
        setIsMicOn(false);
    }, [socket, user?.id]);

    const startStreaming = useCallback(async () => {
        if (!socket || !user?.id) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000,
                } as MediaTrackConstraints,
            });
            localStreamRef.current = stream;
            setIsMicOn(true);
            socket.emit('start_streaming', { 
                commercial_id: user.id, 
                commercial_info: { name: user.name || user.nom || 'Commercial' },
                building_id: buildingId,
                building_name: building ? `${building.adresse}, ${building.ville}` : `Immeuble ${buildingId}`
            });

            // Essayer Deepgram WebSocket côté navigateur pour obtenir du live
            const dgKey = import.meta.env.VITE_DEEPGRAM_API_KEY as string | undefined;
            const dgUrl = 'wss://api.deepgram.com/v1/listen?language=fr&interim_results=true&punctuate=true';
            let useProxy = true;
            if (dgKey && typeof WebSocket !== 'undefined') {
                try {
                    const ws = new WebSocket(dgUrl, ['token', dgKey]);
                    deepgramWsRef.current = ws;
                    ws.onopen = () => {
                        setIsDgLive(true);
                        // Start recorder and send chunks to Deepgram directly
                        const mimeType = 'audio/webm;codecs=opus';
                        const recorder = new MediaRecorder(stream, { mimeType });
                        mediaRecorderRef.current = recorder;
                        recorder.addEventListener('dataavailable', async (e: BlobEvent) => {
                            if (!e.data || e.data.size === 0 || ws.readyState !== ws.OPEN) return;
                            try { ws.send(await e.data.arrayBuffer()); } catch {}
                        });
                        recorder.start(500);
                    };
                    ws.onmessage = (event) => {
                        try {
                            const msg = JSON.parse(event.data as string);
                            const alt = msg?.channel?.alternatives?.[0];
                            const transcript: string = alt?.transcript || '';
                            const is_final: boolean = !!msg?.is_final;
                            if (transcript) {
                                socket.emit('transcription_update', {
                                    commercial_id: user.id,
                                    transcript: transcript + (is_final ? '\n' : ''),
                                    is_final,
                                    timestamp: new Date().toISOString(),
                                    door_id: activeDoorIdRef.current || undefined,
                                    door_label: activeDoorLabelRef.current || undefined,
                                });
                            }
                        } catch {}
                    };
                    ws.onerror = () => { /* fallback below on close */ };
                    ws.onclose = () => {
                        if (isDgLive) return; // closed after stop
                        // fallback to proxy if failed to keep open
                        try { mediaRecorderRef.current?.stop(); } catch {}
                        mediaRecorderRef.current = null;
                        setupProxyRecorder(stream);
                    };
                    useProxy = false;
                } catch (e) {
                    console.warn('Deepgram WS failed, using proxy REST fallback');
                }
            }

            // Fallback: proxy mode via backend
            if (useProxy) {
                setupProxyRecorder(stream);
            }
        } catch (err) {
            console.error('Failed to start audio capture:', err);
        }
    }, [socket, user?.id, user?.name, user?.nom]);

    const setupProxyRecorder = (stream: MediaStream) => {
        if (!socket || !user?.id) return;
        setIsDgLive(false);
        socket.emit('transcription_start', {
            commercial_id: user.id,
            building_id: buildingId,
            building_name: building ? `${building.adresse}, ${building.ville}` : `Immeuble ${buildingId}`,
            mime_type: 'audio/webm;codecs=opus',
        });
        const mimeType = 'audio/webm;codecs=opus';
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        recorder.addEventListener('dataavailable', async (e: BlobEvent) => {
            if (!e.data || e.data.size === 0) return;
            try {
                const buf = await e.data.arrayBuffer();
                socket.emit('transcription_audio_chunk', {
                    commercial_id: user.id,
                    door_id: activeDoorIdRef.current || undefined,
                    door_label: activeDoorLabelRef.current || undefined,
                    chunk: buf,
                });
            } catch (err) {
                console.error('Erreur envoi chunk audio:', err);
            }
        });
        recorder.start(500);
    };

    // Stop audio on unmount if still active + sauvegarde d'urgence
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isMicOn && socket && user?.id) {
                // Sauvegarde synchrone avant fermeture
                socket.emit('emergency_save_session', { commercial_id: user.id });
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && isMicOn && socket && user?.id) {
                // Sauvegarder quand la page devient invisible
                socket.emit('emergency_save_session', { commercial_id: user.id });
            }
        };

        // Écouter les événements de fermeture/changement de page
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            // Nettoyage final avec sauvegarde
            if (isMicOn && socket && user?.id) {
                socket.emit('emergency_save_session', { commercial_id: user.id });
                try { stopStreaming(); } catch {}
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isMicOn, stopStreaming, socket, user?.id]);

    useEffect(() => {
        layoutControls.hideHeader();
        layoutControls.hideBottomBar();
        return () => {
          layoutControls.showHeader();
          layoutControls.showBottomBar();
        };
      }, [layoutControls]);

    const [building, setBuilding] = useState<ImmeubleDetailsFromApi | null>(null);
    const [portes, setPortes] = useState<Porte[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDoor, setEditingDoor] = useState<Porte | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [selectedStatuses, setSelectedStatuses] = useState<Set<PorteStatus>>(new Set());
    const [showRepassageOnly, setShowRepassageOnly] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [doorToDeleteId, setDoorToDeleteId] = useState<string | null>(null);
    const [openFloor, setOpenFloor] = useState<number | null>(1);

    useEffect(() => {
        if (!socket || !buildingId) return;

        socket.on('porteUpdated', (updatedPorte: Porte) => {
            setPortes(prevPortes =>
                prevPortes.map(p => (p.id === updatedPorte.id ? updatedPorte : p))
            );
        });

        return () => {
            socket.off('porteUpdated');
        };
    }, [socket, buildingId]);

    const portesGroupedByFloor = useMemo(() => {
        if (!building) return {};
        const grouped: { [key: number]: Porte[] } = {};
        const numEtages = building.nbEtages || 1;
        for (let i = 1; i <= numEtages; i++) {
            grouped[i] = [];
        }

        portes.forEach(porte => {
            const floor = porte.etage;
            if (grouped[floor]) {
                grouped[floor].push(porte);
            }
        });

        const filteredGrouped: { [key: number]: Porte[] } = {};

        for (let i = 1; i <= numEtages; i++) {
            let floorPortes = grouped[i];
            if (selectedStatuses.size > 0) {
                floorPortes = floorPortes.filter(p => selectedStatuses.has(p.statut));
            }
            if (showRepassageOnly) {
                floorPortes = floorPortes.filter(p => (['ABSENT', 'RDV', 'CURIEUX'].includes(p.statut) && p.passage < 3));
            }
            if (floorPortes.length > 0 || (!showRepassageOnly && selectedStatuses.size === 0)) {
                filteredGrouped[i] = floorPortes;
            }
        }

        return filteredGrouped;
    }, [building, portes, selectedStatuses, showRepassageOnly]);

    const toggleStatusFilter = (status: PorteStatus) => {
        setSelectedStatuses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(status)) {
                newSet.delete(status);
            } else {
                newSet.add(status);
            }
            return newSet;
        });
    };

    const { visitedDoorsCount, coveragePercentage } = useMemo(() => {
        if (!portes.length || !building) {
            return { visitedDoorsCount: 0, coveragePercentage: 0 };
        }
        const visited = portes.filter(p => p.statut !== "NON_VISITE").length;
        const total = building.nbPortesTotal;
        const percentage = total > 0 ? (visited / total) * 100 : 0;
        return {
            visitedDoorsCount: visited,
            coveragePercentage: parseFloat(percentage.toFixed(1)),
        };
    }, [portes, building]);

    const fetchData = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const detailsFromApi = await immeubleService.getImmeubleDetails(id);
            if (detailsFromApi) {
                setBuilding({ ...detailsFromApi });
                const portesFromAPI = (detailsFromApi.portes || []).map((p) => ({
                    id: p.id,
                    numero: p.numeroPorte,
                    statut: p.statut as PorteStatus,
                    commentaire: p.commentaire || null,
                    passage: p.passage,
                    etage: p.etage ?? 1,
                }));
                setPortes(portesFromAPI);
            } else {
                setBuilding(null);
            }
        } catch (error) {
            console.error("Error loading immeuble details:", error);
            toast.error("Erreur lors du chargement de l'immeuble.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (buildingId) {
            fetchData(buildingId);
        }
    }, [buildingId, fetchData]);

    const handleEdit = useCallback((doorId: string) => {
        const doorToEdit = portes.find(p => p.id === doorId);
        if (doorToEdit) {
            setEditingDoor(doorToEdit);
            setIsModalOpen(true);
            // setActiveDoorId(doorId);
            activeDoorIdRef.current = doorId;
            // Construire le label de la porte (Étage X - porte.numero)
            const doorLabel = `Étage ${doorToEdit.etage} - ${doorToEdit.numero}`;
            activeDoorLabelRef.current = doorLabel;
        }
    }, [portes]);

    const handleSaveDoor = async (updatedDoor: Porte) => {
        if (!user) {
            setSaveError("Utilisateur non authentifié.");
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        const needsRepassage = ['ABSENT', 'RDV', 'CURIEUX'].includes(updatedDoor.statut);
        const newPassage = needsRepassage ? Math.min(updatedDoor.passage + 1, 3) : updatedDoor.passage;

        try {
            await porteService.updatePorte(updatedDoor.id, {
                statut: updatedDoor.statut,
                commentaire: updatedDoor.commentaire || '',
                numeroPorte: updatedDoor.numero,
                passage: newPassage,
            });

            const finalUpdatedPorte = { ...updatedDoor, passage: newPassage };
            setPortes(prevPortes =>
                prevPortes.map(p => (p.id === finalUpdatedPorte.id ? finalUpdatedPorte : p))
            );

            // The porteUpdated event from the backend will handle updating the state
            if(buildingId && user.id){
                await statisticsService.triggerHistoryUpdate(user.id, buildingId);
            }
            setIsModalOpen(false);
            setEditingDoor(null);
            toast.success("Statut de la porte mis à jour.");
        } catch (error) {
            setSaveError("Erreur lors de la sauvegarde.");
            console.error("Erreur lors de la mise à jour de la porte:", error);
            toast.error("Erreur lors de la mise à jour.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddDoor = async (floor: number) => {
        if (!buildingId || !user?.id || !building) return;
        const portesOnCurrentFloor = portes.filter(p => p.etage === floor);
        const maxDoorNumber = Math.max(0, ...portesOnCurrentFloor.map(p => parseInt(p.numero.match(/\d+/)?.pop() || '0')));
        const newDoorNumber = `Porte ${maxDoorNumber + 1}`;

        try {
            const newPorteFromApi = await porteService.createPorte({
                numeroPorte: newDoorNumber,
                etage: floor,
                statut: 'NON_VISITE',
                passage: 0,
                immeubleId: buildingId,
            });
            const newPorte: Porte = {
                id: newPorteFromApi.id,
                numero: newPorteFromApi.numeroPorte,
                etage: newPorteFromApi.etage,
                statut: newPorteFromApi.statut as PorteStatus,
                passage: newPorteFromApi.passage,
                commentaire: newPorteFromApi.commentaire
            };
            setPortes([...portes, newPorte]);
            setBuilding(prev => prev ? { ...prev, nbPortesTotal: prev.nbPortesTotal + 1 } : null);
            toast.success("Porte ajoutée.");
        } catch (error) {
            console.error("Error adding door:", error);
            toast.error("Erreur lors de l'ajout de la porte.");
        }
    };

    const handleAddFloor = async () => {
        if (!buildingId || !user?.id || !building) return;
        const newNbEtages = (building.nbEtages || 1) + 1;
        try {
            await immeubleService.updateImmeubleForCommercial(buildingId, {
                nbEtages: newNbEtages,
                nbPortesParEtage: building.nbPortesParEtage || 10,
            }, user.id);
            await fetchData(buildingId);
            toast.success("Étage ajouté.");
        } catch (error) {
            console.error("Error adding floor:", error);
            toast.error("Erreur lors de l'ajout de l'étage.");
        }
    };

    const handleDeleteClick = (doorId: string) => {
        setDoorToDeleteId(doorId);
        setIsConfirmDeleteOpen(true);
    };

    const confirmDeleteDoor = async () => {
        if (!building || !doorToDeleteId) return;
        try {
            await porteService.deletePorte(doorToDeleteId);
            setPortes(portes.filter(p => p.id !== doorToDeleteId));
            setBuilding(prev => prev ? { ...prev, nbPortesTotal: prev.nbPortesTotal - 1 } : null);
            toast.success("Porte supprimée.");
        } catch (error) {
            console.error("Error deleting door:", error);
            toast.error("Erreur lors de la suppression.");
        } finally {
            setIsConfirmDeleteOpen(false);
            setDoorToDeleteId(null);
        }
    };

    if (isLoading) return <PageSkeleton />;

    if (!building) {
        return (
            <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center text-center p-8">
                <Building className="mx-auto h-16 w-16 text-slate-400 mb-4" />
                <h2 className="text-xl font-semibold text-slate-700">Immeuble non trouvé</h2>
                <p className="text-slate-500 mt-2 max-w-sm">Impossible de charger les détails pour cet immeuble.</p>
                <Button variant="outline" onClick={() => navigate('/commercial/prospecting')} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour à la sélection
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 text-slate-800 min-h-screen relative">
            <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <Button variant="outline" onClick={() => navigate('/commercial/prospecting')} className="mb-6 bg-white">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la sélection
                    </Button>
                </motion.div>
                <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <CardHeader className="p-6">
                        
                        <CardDescription className="text-slate-600 mt-2">
                            {building.nbPortesTotal} portes à prospecter. Mettez à jour leur statut au fur et à mesure.
                        </CardDescription>
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="text-lg font-semibold text-slate-800">
                                Couverture: {visitedDoorsCount} / {building.nbPortesTotal} portes ({coveragePercentage}%)
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                                <motion.div 
                                    className="bg-blue-500 h-2.5 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${coveragePercentage}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 border-t border-slate-200">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-600 mr-2">Filtres:</span>
                            {statusList.map(status => {
                                const config = statusConfig[status];
                                const isSelected = selectedStatuses.has(status);
                                return (
                                    <button
                                        key={status}
                                        onClick={() => toggleStatusFilter(status)}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all duration-200",
                                            isSelected 
                                                ? `${config.badgeClassName} ring-2 ring-offset-1 ring-blue-500`
                                                : `bg-slate-100 text-slate-700 hover:bg-slate-200`,
                                            config.badgeClassName
                                        )}
                                    >
                                        <config.icon className="h-3.5 w-3.5" />
                                        {config.label}
                                    </button>
                                )
                            })}
                            <button
                                onClick={() => setShowRepassageOnly(!showRepassageOnly)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all duration-200",
                                    showRepassageOnly
                                        ? 'bg-yellow-400 text-yellow-900 ring-2 ring-offset-1 ring-yellow-500'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                )}
                            >
                                <Repeat className="h-3.5 w-3.5" />
                                À repasser
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {Object.keys(portesGroupedByFloor).length === 0 ? (
                    <div className="text-center text-slate-500 py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <p>Aucune porte ne correspond aux filtres sélectionnés.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.keys(portesGroupedByFloor).sort((a, b) => parseInt(a) - parseInt(b)).map(floorStr => {
                            const floor = parseInt(floorStr);
                            const isOpen = openFloor === floor;
                            return (
                                <Card key={floor} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                    <CardHeader 
                                        className={cn(
                                            "p-4 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors",
                                            isOpen ? "bg-slate-100" : "bg-slate-50"
                                        )}
                                        onClick={() => setOpenFloor(isOpen ? null : floor)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-lg font-semibold text-slate-800">
                                                Étage {floor} ({portesGroupedByFloor[floor]?.length || 0} portes)
                                            </CardTitle>
                                            <ChevronDown className={cn("h-5 w-5 text-slate-500 transition-transform", isOpen && "rotate-180")} />
                                        </div>
                                    </CardHeader>
                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                    {portesGroupedByFloor[floor].map((porte) => {
                                                        const config = statusConfig[porte.statut];
                                                        const StatusIcon = config?.icon || DoorOpen;
                                                        return (
                                                            <motion.div
                                                                key={porte.id}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.3 }}
                                                                className="h-full"
                                                            >
                                                                <Card 
                                                                    className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm"
                                                                >
                                                                    <div className="flex-grow cursor-pointer hover:bg-slate-50 transition-colors rounded-t-xl" onClick={() => handleEdit(porte.id)}>
                                                                        <CardHeader className="flex flex-row items-start justify-between p-4">
                                                                            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800 pt-1">
                                                                                <DoorOpen className="h-5 w-5 text-slate-500" />
                                                                                {porte.numero}
                                                                            </CardTitle>
                                                                            <div className="flex items-center gap-1">
                                                                                <span className={cn("text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1.5", config?.badgeClassName)}>
                                                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                                                    {config.label}
                                                                                </span>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteClick(porte.id);
                                                                                    }}
                                                                                    className="text-red-500 hover:bg-red-100 rounded-full h-7 w-7 shrink-0"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </CardHeader>
                                                                        <CardContent className="flex-grow p-4 pt-2 space-y-3 text-sm">
                                                                            {porte.commentaire ? (
                                                                                <p className="italic text-slate-600 line-clamp-2">“{porte.commentaire}”</p>
                                                                            ) : (
                                                                                <p className="italic text-slate-400">Aucun commentaire</p>
                                                                            )}
                                                                            {(porte.statut === 'ABSENT' || porte.statut === 'RDV' || porte.statut === 'CURIEUX') && porte.passage > 0 && (
                                                                                <div className="flex items-center justify-between rounded-lg border p-2 bg-slate-50">
                                                                                    <span className="font-medium text-sm text-slate-600">Passage</span>
                                                                                    <span className={cn("font-bold text-base", porte.passage >= 3 ? "text-red-500" : "text-blue-600")}>
                                                                                        {porte.passage >= 3 ? "Stop" : `${porte.passage}${porte.passage === 1 ? 'er' : 'ème'}`}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </CardContent>
                                                                    </div>
                                                                </Card>
                                                            </motion.div>
                                                        );
                                                    })}
                                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="h-full">
                                                        <Card 
                                                            className="flex flex-col h-full items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer rounded-xl"
                                                            onClick={() => handleAddDoor(floor)}
                                                        >
                                                            <Plus className="h-8 w-8 text-slate-400" />
                                                            <p className="mt-2 text-sm font-semibold text-slate-600">Ajouter une porte</p>
                                                        </Card>
                                                    </motion.div>
                                                </CardContent>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            )
                        })}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full">
                            <Card 
                                className="flex flex-col h-full items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer rounded-2xl py-8"
                                onClick={handleAddFloor}
                            >
                                <Plus className="h-10 w-10 text-slate-400" />
                                <p className="mt-4 text-lg font-semibold text-slate-600">Ajouter un étage</p>
                            </Card>
                        </motion.div>
                    </div>
                )}

                {/* Floating mic control */}
                <button
                    type="button"
                    aria-label={isMicOn ? 'Couper le micro' : 'Activer le micro'}
                    onClick={() => (isMicOn ? stopStreaming() : startStreaming())}
                    className={cn(
                        'fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center border',
                        isMicOn ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-800 border-slate-200'
                    )}
                >
                    {isMicOn ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>

                {editingDoor && (
                    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Mettre à jour: ${editingDoor.numero}`} maxWidth="sm:max-w-2xl">
                        <div className="p-6 space-y-6">
                            <div className="grid gap-2">
                                <Label htmlFor="numero">Numéro de Porte</Label>
                                <Input id="numero" value={editingDoor.numero || ''} onChange={(e) => setEditingDoor({ ...editingDoor, numero: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Statut</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {statusList.map((status) => {
                                        const config = statusConfig[status];
                                        const isSelected = editingDoor.statut === status;
                                        return (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setEditingDoor({ ...editingDoor, statut: status })}
                                                className={cn(
                                                    "w-full py-2.5 px-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 border",
                                                    isSelected
                                                        ? `${config.buttonClassName} text-white shadow-md ring-2 ring-offset-2 ring-blue-500`
                                                        : `${config.badgeClassName} hover:shadow-sm hover:brightness-105`
                                                )}
                                            >
                                                <config.icon className="h-4 w-4" />
                                                <span>{config.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="commentaire">Commentaire</Label>
                                <Input id="commentaire" value={editingDoor.commentaire || ''} onChange={(e) => setEditingDoor({ ...editingDoor, commentaire: e.target.value })} placeholder="Ajouter un commentaire..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Annuler</Button>
                            <Button type="submit" onClick={() => handleSaveDoor(editingDoor)} className="bg-blue-600 text-white hover:bg-blue-700" disabled={isSaving}>
                                {isSaving && <Repeat className="mr-2 h-4 w-4 animate-spin" />} 
                                {isSaving ? "Enregistrement..." : "Enregistrer"}
                            </Button>
                        </div>
                        {saveError && <p className="text-red-500 text-sm mt-2 px-6 pb-4">{saveError}</p>}
                    </Modal>
                )}

                <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
                    <AlertDialogContent className="bg-white rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action est irréversible. La porte sera définitivement supprimée.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteDoor} className="bg-red-600 hover:bg-red-700 text-white">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default ProspectingDoorsPage;
    const getIceServers = () => {
        const iceServers: RTCIceServer[] = [];
        const stun = import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302';
        if (stun) iceServers.push({ urls: stun });
        const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
        const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
        const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
        if (turnUrl && turnUser && turnCred) {
            iceServers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
        }
        return iceServers;
    };
