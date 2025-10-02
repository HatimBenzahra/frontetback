import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { type LayoutControls } from '@/layout/layout.types';
import PageSkeleton from '@/components/PageSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-admin/card';
import { type Porte, statusConfig, statusList, type PorteStatus } from './doors-config';
import { ArrowLeft, Building, DoorOpen, Repeat, Trash2, Plus, ChevronDown, Mic, MicOff, Calendar as CalendarIcon, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import { Modal } from '@/components/ui-admin/Modal';
import { Input } from '@/components/ui-admin/input';
import { Button } from '@/components/ui-admin/button';
import { Label } from '@/components/ui-admin/label';
import { Calendar } from '@/components/ui-admin/calendar';
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


type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

const getSpeechRecognition = (): SpeechRecognitionInstance | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const ctor = (window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).SpeechRecognition || (window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).webkitSpeechRecognition;
  if (!ctor) {
    return null;
  }
  try {
    return new ctor();
  } catch (error) {
    console.error('Failed to create SpeechRecognition instance:', error);
    return null;
  }
};


const ProspectingDoorsPage = () => {
    const {buildingId } = useParams<{ buildingId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const layoutControls = useOutletContext<LayoutControls>();
    const socket = useSocket(buildingId);
    const [building, setBuilding] = useState<ImmeubleDetailsFromApi | null>(null);
    // Audio streaming state
    const [isMicOn, setIsMicOn] = useState(false);
    const localStreamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const isMicOnRef = useRef(false);
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
            console.log('📞 Offer WebRTC reçu de:', payload.from_socket_id);
            console.log('  - isMicOn:', isMicOn);
            console.log('  - isMicOnRef.current:', isMicOnRef.current);
            console.log('  - localStreamRef.current exists:', !!localStreamRef.current);
            
            if (!isMicOnRef.current) {
                console.warn('❌ Offer rejeté: Micro non actif');
                return;
            }
            try {
                if (!localStreamRef.current) {
                    console.warn('❌ Offer rejeté: Pas de stream local');
                    return;
                }
                console.log('✅ Création de la peer connection pour:', payload.from_socket_id);
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
                console.log('✅ Answer créé et envoyé à:', payload.from_socket_id);
                socket.emit('suivi:webrtc_answer', {
                    to_socket_id: payload.from_socket_id,
                    sdp: answer.sdp,
                    type: answer.type,
                });
            } catch (err) {
                console.error('❌ Error handling offer:', err);
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
        if (recognitionRef.current) {
            const recognition = recognitionRef.current;
            recognition.onend = null;
            try { recognition.stop(); } catch {}
            if (typeof recognition.abort === 'function') {
                try { recognition.abort(); } catch {}
            }
        }
        recognitionRef.current = null;
        if (socket && user?.id) {
            socket.emit('transcription_stop', { commercial_id: user.id });
            socket.emit('stop_streaming', { commercial_id: user.id });
        }
        isMicOnRef.current = false;
        setIsMicOn(false);
    }, [socket, user?.id]);

    // Fonction pour optimiser la capture audio
    const optimizeAudioCapture = (stream: MediaStream) => {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            // Optimiser les paramètres de la piste audio
            const settings = audioTrack.getSettings();
            
            // Optimiser la qualité si possible
            const capabilities = audioTrack.getCapabilities();
            if (capabilities.sampleRate) {
                const maxSampleRate = capabilities.sampleRate.max || 48000;
                audioTrack.applyConstraints({
                    sampleRate: maxSampleRate
                }).catch(console.warn);
            }
            
            console.log('🎤 Audio track optimisée:', settings);
        }
    };

    const startStreaming = useCallback(async () => {
        if (!socket || !user?.id) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // Optimisations pour une meilleure capture et stabilité
                    echoCancellation: true,  // Réactivé pour éviter les échos
                    noiseSuppression: true,  // Réactivé pour améliorer la qualité
                    autoGainControl: true,   // Réactivé pour normaliser le volume
                    channelCount: 1,
                    sampleRate: 48000,
                    latency: 0,
                    volume: 1.0,
                    sampleSize: 16,
                    suppressLocalAudioPlayback: false,
                } as MediaTrackConstraints,
            });

            // Optimiser la capture audio pour maximiser la sensibilité
            optimizeAudioCapture(stream);

            localStreamRef.current = stream;
            isMicOnRef.current = true;
            setIsMicOn(true);
            
            // Un seul événement suffit pour créer la session
            socket.emit('start_streaming', {
                commercial_id: user.id,
                commercial_info: { name: user.name || user.nom || 'Commercial' },
                building_id: buildingId,
                building_name: building ? `${building.adresse}, ${building.ville}` : `Immeuble ${buildingId}`
            });

            const recognition = getSpeechRecognition();
            if (!recognition) {
                console.error('La reconnaissance vocale n\'est pas supportée par ce navigateur.');
                return;
            }

            recognition.lang = 'fr-FR';
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;

            let lastFinalTranscript = '';
            let restartAttempts = 0;
            const MAX_RESTART_ATTEMPTS = 5;

            recognition.onresult = (event: SpeechRecognitionEventLike) => {
                for (let i = event.resultIndex; i < event.results.length; i += 1) {
                    const result = event.results[i];
                    const alternative = result[0];
                    const transcript = alternative?.transcript?.trim();
                    if (!transcript) continue;
                    const isFinal = !!result.isFinal;
                    
                    // Éviter les doublons de transcriptions finales
                    if (isFinal && transcript === lastFinalTranscript) {
                        console.log('🔄 Transcription finale dupliquée détectée, ignorée:', transcript);
                        continue;
                    }
                    
                    if (isFinal) {
                        lastFinalTranscript = transcript;
                        restartAttempts = 0; // Reset le compteur en cas de succès
                    }
                    
                    socket.emit('transcription_update', {
                        commercial_id: user.id,
                        transcript,
                        is_final: isFinal,
                        timestamp: new Date().toISOString(),
                        door_id: activeDoorIdRef.current || undefined,
                        door_label: activeDoorLabelRef.current || undefined,
                    });
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    console.error('Autorisez l\'utilisation du micro pour la transcription.');
                    stopStreaming();
                } else if (event.error === 'no-speech') {
                    // Ignorer l'erreur no-speech, le redémarrage automatique gérera
                    console.log('ℹ️  Pas de parole détectée, continuation...');
                } else if (event.error === 'aborted') {
                    console.log('ℹ️  Reconnaissance vocale interrompue');
                } else {
                    console.warn(`⚠️  Erreur de reconnaissance vocale: ${event.error}`);
                }
            };

            recognition.onend = () => {
                if (!isMicOnRef.current) {
                    console.log('🛑 Reconnaissance vocale arrêtée (micro désactivé)');
                    return;
                }
                
                // Limiter les tentatives de redémarrage pour éviter les boucles infinies
                if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
                    console.error(`❌ Échec du redémarrage de la reconnaissance vocale après ${MAX_RESTART_ATTEMPTS} tentatives`);
                    stopStreaming();
                    return;
                }
                
                try {
                    restartAttempts++;
                    console.log(`🔄 Redémarrage de la reconnaissance vocale (tentative ${restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
                    setTimeout(() => {
                        if (isMicOnRef.current) {
                            recognition.start();
                        }
                    }, 100); // Petit délai pour éviter les conflits
                } catch (error) {
                    console.error('Failed to restart speech recognition:', error);
                    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
                        stopStreaming();
                    }
                }
            };

            recognitionRef.current = recognition;

            try {
                recognition.start();
            } catch (error) {
                console.error('Failed to start speech recognition:', error);
                recognitionRef.current = null;
            }
        } catch (err) {
            console.error('Failed to start audio capture:', err);
        }
    }, [socket, user?.id, user?.name, user?.nom, buildingId, building, stopStreaming]);

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
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [showCalendar, setShowCalendar] = useState(false);

    // Ref pour le debounce des stats
    const updateStatsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Fonction robuste pour mettre à jour les stats avec debounce
    const triggerStatsUpdateDebounced = useCallback(() => {
        if (updateStatsTimeoutRef.current) {
            clearTimeout(updateStatsTimeoutRef.current);
        }
        
        updateStatsTimeoutRef.current = setTimeout(async () => {
            if (buildingId && user?.id) {
                try {
                    console.log('🔄 Mise à jour des statistiques depuis WebSocket...');
                    await statisticsService.triggerHistoryUpdate(user.id, buildingId);
                    console.log('✅ Statistiques mises à jour avec succès');
                } catch (error) {
                    console.error('❌ Erreur lors de la mise à jour des statistiques:', error);
                }
            }
        }, 500); // Attendre 500ms avant de déclencher
    }, [buildingId, user?.id]);

    useEffect(() => {
        if (!socket || !buildingId) return;

        // Handler robuste pour mise à jour des portes et stats
        const handlePorteUpdate = async (updatedPorte: any, porteId?: string, updates?: any) => {
            let hasStatusChanged = false;
            
            // Mettre à jour les portes localement
            setPortes(prevPortes =>
                prevPortes.map(p => {
                    if (p.id === (updatedPorte?.id || porteId)) {
                        let newPorte;
                        const oldStatus = p.statut;
                        
                        if (updatedPorte) {
                            // Format complet de la porte (backend)
                            newPorte = {
                                ...updatedPorte,
                                numero: updatedPorte.numeroPorte || updatedPorte.numero || p.numero,
                                dateRendezVous: updatedPorte.dateRendezVous || p.dateRendezVous,
                            };
                            hasStatusChanged = oldStatus !== updatedPorte.statut;
                        } else if (updates) {
                            // Format partiel (admin)
                            newPorte = {
                                ...p,
                                ...updates,
                                numero: updates.numeroPorte || p.numero,
                                dateRendezVous: updates.dateRendezVous || p.dateRendezVous,
                            };
                            hasStatusChanged = updates.statut && oldStatus !== updates.statut;
                        }
                        
                        if (hasStatusChanged) {
                            console.log(`🔄 Changement de statut détecté: ${oldStatus} → ${newPorte?.statut || updates?.statut}`);
                        }
                        
                        return newPorte || p;
                    }
                    return p;
                })
            );
            
            // Toujours déclencher la mise à jour des stats pour les changements via WebSocket
            // car cela signifie qu'une modification externe a eu lieu
            console.log('🔄 Modification de porte reçue via WebSocket - déclenchement des stats');
            triggerStatsUpdateDebounced();
        };

        // Écouter l'événement du backend (format complet)
        socket.on('porteUpdated', (updatedPorte: any) => {
            handlePorteUpdate(updatedPorte);
        });

        // Écouter l'événement de l'admin (format partiel)
        socket.on('porte:update', (data: { porteId: string; updates: any }) => {
            handlePorteUpdate(null, data.porteId, data.updates);
        });

        socket.on('porte:added', (data: { porte: any }) => {
            const newPorte = {
                id: data.porte.id,
                numero: data.porte.numeroPorte,
                statut: data.porte.statut as PorteStatus,
                commentaire: data.porte.commentaire || null,
                passage: data.porte.passage,
                etage: data.porte.etage,
                dateRendezVous: data.porte.dateRendezVous || null,
            };
            setPortes(prevPortes => [...prevPortes, newPorte]);
        });

        socket.on('porte:deleted', (data: { porteId: string }) => {
            setPortes(prevPortes => prevPortes.filter(p => p.id !== data.porteId));
        });

        socket.on('floor:added', (data: { newNbEtages: number }) => {
            setBuilding(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    nbEtages: data.newNbEtages
                };
            });
        });

        return () => {
            socket.off('porteUpdated');
            socket.off('porte:update');
            socket.off('porte:added');
            socket.off('porte:deleted');
            socket.off('floor:added');
            
            // Nettoyer le timeout des stats
            if (updateStatsTimeoutRef.current) {
                clearTimeout(updateStatsTimeoutRef.current);
            }
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
        if (!portes.length) {
            return { visitedDoorsCount: 0, coveragePercentage: 0 };
        }
        const visited = portes.filter(p => p.statut !== "NON_VISITE").length;
        const total = portes.length;
        const percentage = total > 0 ? (visited / total) * 100 : 0;
        return {
            visitedDoorsCount: visited,
            coveragePercentage: parseFloat(percentage.toFixed(1)),
        };
    }, [portes]);

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
                    dateRendezVous: p.dateRendezVous || null,
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
            setShowCalendar(false);
            // setActiveDoorId(doorId);
            activeDoorIdRef.current = doorId;
            // Construire le label de la porte (Étage X - porte.numero)
            const doorLabel = `Étage ${doorToEdit.etage} - ${doorToEdit.numero}`;
            activeDoorLabelRef.current = doorLabel;
            // Initialiser la date de rendez-vous si elle existe
            setSelectedDate(doorToEdit.dateRendezVous ? new Date(doorToEdit.dateRendezVous) : undefined);
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
                numeroPorte: updatedDoor.numero,
                statut: updatedDoor.statut,
                commentaire: updatedDoor.commentaire || '',
                passage: newPassage,
                dateRendezVous: selectedDate ? selectedDate.toISOString() : undefined,
            });

            const finalUpdatedPorte = { ...updatedDoor, passage: newPassage };
            setPortes(prevPortes =>
                prevPortes.map(p => (p.id === finalUpdatedPorte.id ? finalUpdatedPorte : p))
            );

            // Emit socket event for real-time sync with admin panel
            if (socket && buildingId) {
                socket.emit('immeubleUpdated', { 
                    immeubleId: buildingId,
                    type: 'porte_update'
                });
            }

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
        const maxDoorNumber = Math.max(0, ...portesOnCurrentFloor.map(p => {
            if (!p.numero) return 0;
            const match = p.numero.match(/\d+/);
            return parseInt(match?.pop() || '0');
        }));
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
                commentaire: newPorteFromApi.commentaire,
                dateRendezVous: newPorteFromApi.dateRendezVous
            };
            setPortes([...portes, newPorte]);
            
            // Emit socket event for real-time sync with admin panel
            if (socket && buildingId) {
                socket.emit('immeubleUpdated', { 
                    immeubleId: buildingId,
                    type: 'porte_added'
                });
            }
            
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
            
            // Emit socket event for real-time sync with admin panel
            if (socket && buildingId) {
                socket.emit('immeubleUpdated', { 
                    immeubleId: buildingId,
                    type: 'floor_added'
                });
            }
            
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
            
            // Emit socket event for real-time sync with admin panel
            if (socket && buildingId) {
                socket.emit('immeubleUpdated', { 
                    immeubleId: buildingId,
                    type: 'porte_deleted'
                });
            }
            
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
        <div className="bg-slate-50 text-slate-800 min-h-screen relative pt-6 pb-6">
            {/* Floating Back Button */}
            <button
                onClick={() => navigate('/commercial/prospecting')}
                className="fixed top-6 left-6 z-50 h-12 w-12 bg-white border border-slate-200 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors"
                aria-label="Retour à la sélection"
            >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            
            <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
                <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <CardHeader className="p-6">
                        
                        <CardDescription className="text-slate-600 mt-2">
                            {portes.length} portes à prospecter. Mettez à jour leur statut au fur et à mesure.
                        </CardDescription>
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="text-lg font-semibold text-slate-800">
                                Couverture: {visitedDoorsCount} / {portes.length} portes ({coveragePercentage}%)
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
                                                                            {porte.statut === 'RDV' && porte.dateRendezVous && (
                                                                                <div className="flex items-center justify-between rounded-lg border p-2 bg-sky-50">
                                                                                    <span className="font-medium text-sm text-sky-700">Rendez-vous</span>
                                                                                    <span className="font-bold text-sm text-sky-800">
                                                                                        {new Date(porte.dateRendezVous).toLocaleDateString('fr-FR', {
                                                                                            day: '2-digit',
                                                                                            month: '2-digit',
                                                                                            year: 'numeric'
                                                                                        })}
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
                    <Modal isOpen={isModalOpen} onClose={() => {
                        setIsModalOpen(false);
                        setSelectedDate(undefined);
                        setShowCalendar(false);
                    }} title={`Mettre à jour: ${editingDoor.numero}`} maxWidth="sm:max-w-lg">
                        <div className="relative overflow-hidden">
                            {/* Header avec navigation */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                                <div className="flex items-center gap-3">
                                    {showCalendar && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowCalendar(false)}
                                            className="p-2 h-8 w-8"
                                        >
                                            <ArrowLeftIcon className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-slate-900">
                                            {showCalendar ? 'Choisir une date' : 'Sélectionner un statut'}
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            {showCalendar ? 'Sélectionnez la date du rendez-vous' : 'Choisissez le statut de la porte'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Contenu principal avec animation */}
                            <div className="p-4">
                                <AnimatePresence mode="wait">
                                    {!showCalendar ? (
                                        // Vue des statuts
                                        <motion.div
                                            key="status-view"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="space-y-4"
                                        >
                                            {/* Numéro de porte */}
                            <div className="grid gap-2">
                                                <Label htmlFor="numero" className="text-sm font-medium text-slate-700">Numéro de Porte</Label>
                                                <Input 
                                                    id="numero" 
                                                    value={editingDoor.numero || ''} 
                                                    onChange={(e) => setEditingDoor({ ...editingDoor, numero: e.target.value })}
                                                    className="h-10"
                                                />
                            </div>

                                            {/* Grille des statuts */}
                            <div className="grid gap-2">
                                                <Label className="text-sm font-medium text-slate-700">Statut</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                    {statusList.map((status) => {
                                        const config = statusConfig[status];
                                        const isSelected = editingDoor.statut === status;
                                        return (
                                            <button
                                                key={status}
                                                type="button"
                                                                onClick={() => {
                                                                    setEditingDoor({ ...editingDoor, statut: status });
                                                                    if (status === 'RDV') {
                                                                        setShowCalendar(true);
                                                                    }
                                                                }}
                                                className={cn(
                                                                    "w-full py-3 px-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border-2",
                                                    isSelected
                                                                        ? `${config.buttonClassName} text-white shadow-lg ring-2 ring-offset-2 ring-blue-500 border-transparent`
                                                                        : `${config.badgeClassName} hover:shadow-md hover:scale-105 border-transparent`
                                                )}
                                            >
                                                <config.icon className="h-4 w-4" />
                                                <span>{config.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                                            {/* Commentaire */}
                            <div className="grid gap-2">
                                                <Label htmlFor="commentaire" className="text-sm font-medium text-slate-700">Commentaire</Label>
                                                <Input 
                                                    id="commentaire" 
                                                    value={editingDoor.commentaire || ''} 
                                                    onChange={(e) => setEditingDoor({ ...editingDoor, commentaire: e.target.value })} 
                                                    placeholder="Ajouter un commentaire..." 
                                                    className="h-10"
                                                />
                            </div>
                                        </motion.div>
                                    ) : (
                                        // Vue du calendrier
                                        <motion.div
                                            key="calendar-view"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="space-y-4"
                                        >
                                            {/* Sélecteur rapide pour les prochains jours */}
                                            <div className="grid gap-2">
                                                <Label className="text-sm font-medium text-slate-700">Sélection rapide</Label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[1, 2, 3, 7, 14, 30].map((days) => {
                                                        const date = new Date();
                                                        date.setDate(date.getDate() + days);
                                                        const isSelected = selectedDate && 
                                                            selectedDate.toDateString() === date.toDateString();
                                                        return (
                                                            <button
                                                                key={days}
                                                                onClick={() => setSelectedDate(date)}
                                                                className={cn(
                                                                    "p-3 rounded-xl border-2 text-center transition-all duration-200 min-h-[60px] flex flex-col justify-center",
                                                                    isSelected
                                                                        ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold shadow-md"
                                                                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                                                                )}
                                                            >
                                                                <div className="text-xs font-medium text-slate-600">
                                                                    {days === 1 ? "Demain" : `+${days}j`}
                        </div>
                                                                <div className="text-sm font-bold">
                                                                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Séparateur */}
                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <span className="w-full border-t border-slate-200" />
                                                </div>
                                                <div className="relative flex justify-center text-xs uppercase">
                                                    <span className="bg-white px-3 text-slate-500 font-medium">Ou choisir une date</span>
                                                </div>
                                            </div>

                                            {/* Calendrier moderne et responsive */}
                                            <div className="grid gap-2">
                                                <Label className="text-sm font-medium text-slate-700">Calendrier</Label>
                                                <div className="flex justify-center">
                                                    <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm">
                                                        <Calendar
                                                            mode="single"
                                                            selected={selectedDate}
                                                            onSelect={setSelectedDate}
                                                            className="rounded-md"
                                                            classNames={{
                                                                root: "w-auto",
                                                                months: "w-auto",
                                                                month: "w-auto",
                                                                caption: "flex justify-center pt-1 relative items-center text-base font-bold text-slate-800 mb-3",
                                                                caption_label: "text-base font-bold text-slate-800",
                                                                nav: "space-x-1 flex items-center",
                                                                nav_button: cn(
                                                                    "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-slate-100 rounded-lg transition-all duration-200"
                                                                ),
                                                                nav_button_previous: "absolute left-1",
                                                                nav_button_next: "absolute right-1",
                                                                table: "w-auto border-collapse space-y-1",
                                                                head_row: "flex mb-2",
                                                                head_cell: "text-slate-600 rounded-md w-8 sm:w-9 font-semibold text-xs",
                                                                row: "flex w-full mt-1",
                                                                cell: cn(
                                                                    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-slate-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
                                                                ),
                                                                day: cn(
                                                                    "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-slate-100 rounded-lg transition-all duration-200 text-sm"
                                                                ),
                                                                day_selected: "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white",
                                                                day_today: "bg-blue-100 text-blue-800 font-semibold",
                                                                day_outside: "text-slate-400 opacity-50",
                                                                day_disabled: "text-slate-400 opacity-50 cursor-not-allowed",
                                                                day_range_middle: "aria-selected:bg-slate-100 aria-selected:text-slate-800",
                                                                day_hidden: "invisible",
                                                            }}
                                                            disabled={(date) => date < new Date()}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Affichage de la date sélectionnée */}
                                            {selectedDate && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-blue-50 border border-blue-200 rounded-xl p-4"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-shrink-0">
                                                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                                                                <CalendarIcon className="w-6 h-6 text-white" />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm font-bold text-blue-800">
                                                                {selectedDate.toLocaleDateString('fr-FR', {
                                                                    weekday: 'long',
                                                                    day: 'numeric',
                                                                    month: 'long',
                                                                    year: 'numeric'
                                                                })}
                                                            </div>
                                                            <div className="text-xs text-blue-600">
                                                                Rendez-vous confirmé
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setSelectedDate(undefined)}
                                                            className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Footer avec boutons */}
                            <div className="flex justify-end gap-3 p-4 bg-slate-50 border-t border-slate-200">
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setSelectedDate(undefined);
                                        setShowCalendar(false);
                                    }}
                                >
                                    Annuler
                                </Button>
                                <Button 
                                    type="submit" 
                                    onClick={() => handleSaveDoor(editingDoor)} 
                                    className="bg-blue-600 text-white hover:bg-blue-700" 
                                    disabled={isSaving}
                                >
                                {isSaving && <Repeat className="mr-2 h-4 w-4 animate-spin" />} 
                                {isSaving ? "Enregistrement..." : "Enregistrer"}
                            </Button>
                        </div>
                        </div>
                        {saveError && <p className="text-red-500 text-sm mt-2 px-4 pb-4">{saveError}</p>}
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
        
        // Plusieurs serveurs STUN pour plus de robustesse
        const stunServers = [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun.services.mozilla.com:3478'
        ];
        
        const customStun = import.meta.env.VITE_STUN_URL;
        if (customStun) {
            iceServers.push({ urls: customStun });
        } else {
            // Utiliser tous les serveurs STUN publics par défaut
            iceServers.push({ urls: stunServers });
        }
        
        // Serveur TURN si configuré (nécessaire pour NAT restrictif)
        const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
        const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
        const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
        if (turnUrl && turnUser && turnCred) {
            iceServers.push({ 
                urls: turnUrl, 
                username: turnUser, 
                credential: turnCred 
            });
            console.log('✅ Serveur TURN configuré');
        } else {
            console.warn('⚠️ Pas de serveur TURN configuré - peut échouer avec NAT restrictif');
        }
        
        return iceServers;
    };
