import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { type LayoutControls } from '@/layout/layout.types';
import PageSkeleton from '@/components/PageSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-admin/card';
import { type Porte, statusConfig, statusList, type PorteStatus } from './doors-config';
import { ArrowLeft, Building, DoorOpen, Repeat, Trash2, Plus, ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui-admin/Modal';
import { Input } from '@/components/ui-admin/input';
import { Button } from '@/components/ui-admin/button';
import { Label } from '@/components/ui-admin/label';
import { immeubleService, type ImmeubleDetailsFromApi } from '@/services/immeuble.service';
import { porteService } from '@/services/porte.service';
import { statisticsService } from '@/services/statistics.service';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PYTHON_SERVER_URL } from '@/config';
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
import { useAudioStreaming } from '@/hooks/useAudioStreaming';
import { useDeepgramTranscription } from '@/hooks/useDeepgramTranscription';
import { transcriptionHistoryService } from '@/services/transcriptionHistory.service';
import { Mic, MicOff } from 'lucide-react';


const ProspectingDoorsPage = () => {
    const { buildingId } = useParams<{ buildingId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const layoutControls = useOutletContext<LayoutControls>();
    const socket = useSocket(buildingId);

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

    // Configuration du streaming audio pour les commerciaux - utilise la config centralisée
    const audioServerUrl = PYTHON_SERVER_URL;
    console.log('🎤 COMMERCIAL PAGE - Configuration audio streaming:');
    console.log('🎤 COMMERCIAL PAGE - Server URL:', audioServerUrl);
    console.log('🎤 COMMERCIAL PAGE - User ID:', user?.id);
    console.log('🎤 COMMERCIAL PAGE - User role: commercial');
    console.log('🎤 COMMERCIAL PAGE - User info:', {
        name: user?.nom || '',
        equipe: 'Équipe Commercial'
    });

    const audioStreaming = useAudioStreaming({
        serverUrl: audioServerUrl,
        userId: user?.id || '',
        userRole: 'commercial',
        userInfo: {
            name: user?.nom || '',
            equipe: 'Équipe Commercial'
        }
    });

    // Hook pour la transcription côté commercial
    const deepgramTranscription = useDeepgramTranscription();

    // Gestion de l'arrêt brusque (fermeture de page, navigation, etc.)
    useEffect(() => {
        const handleBeforeUnload = async () => {
            if (audioStreaming.isStreaming) {
                console.log('🚨 Arrêt brusque détecté - Sauvegarde automatique de la transcription');
                try {
                    const transcriptionSession = await deepgramTranscription.stopTranscription();
                    if (transcriptionSession && transcriptionSession.full_transcript.trim()) {
                        const enrichedSession = {
                            ...transcriptionSession,
                            commercial_name: user?.nom || 'Commercial',
                            building_id: buildingId,
                            building_name: building ? `${building.adresse}, ${building.ville}` : 'Bâtiment'
                        };
                        await transcriptionHistoryService.saveTranscriptionSession(enrichedSession);
                        console.log('📚 Session transcription sauvegardée lors de l\'arrêt brusque');
                    }
                } catch (error) {
                    console.error('❌ Erreur sauvegarde lors de l\'arrêt brusque:', error);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [audioStreaming.isStreaming, deepgramTranscription, user?.nom, buildingId, building]);

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

    // Connecter au serveur de streaming audio
    useEffect(() => {
        console.log('🎤 COMMERCIAL PAGE - useEffect connexion audio, user:', user?.id);
        if (user?.id) {
            console.log('🎤 COMMERCIAL PAGE - Tentative de connexion au serveur audio...');
            audioStreaming.connect();
        }
        
        return () => {
            console.log('🎤 COMMERCIAL PAGE - Déconnexion du serveur audio');
            audioStreaming.disconnect();
        };
    }, [user?.id]);

    const handleEdit = useCallback((doorId: string) => {
        const doorToEdit = portes.find(p => p.id === doorId);
        if (doorToEdit) {
            setEditingDoor(doorToEdit);
            setIsModalOpen(true);
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

    const handleToggleStreaming = async () => {
        console.log('🎤 COMMERCIAL PAGE - handleToggleStreaming appelé!');
        console.log('🎤 COMMERCIAL PAGE - État actuel isStreaming:', audioStreaming.isStreaming);
        console.log('🎤 COMMERCIAL PAGE - État connexion:', audioStreaming.isConnected);
        
        try {
            if (audioStreaming.isStreaming) {
                console.log('🎤 COMMERCIAL PAGE - Arrêt du streaming...');
                await audioStreaming.stopStreaming();
                
                // Arrêter la transcription et récupérer la session AVANT nettoyage
                const transcriptionSession = await deepgramTranscription.stopTranscription();
                
                // Sauvegarder automatiquement l'historique de transcription (NOUVEAU HISTORIQUE À CHAQUE CYCLE)
                if (transcriptionSession && transcriptionSession.full_transcript.trim()) {
                    try {
                        // Enrichir la session avec les informations du bâtiment
                        const enrichedSession = {
                            ...transcriptionSession,
                            commercial_name: user?.nom || 'Commercial',
                            building_id: buildingId,
                            building_name: building ? `${building.adresse}, ${building.ville}` : 'Bâtiment'
                        };
                        
                        await transcriptionHistoryService.saveTranscriptionSession(enrichedSession);
                        console.log('📚 NOUVEAU HISTORIQUE sauvegardé avec ID:', enrichedSession.id);
                        console.log('📚 Contenu historique:', enrichedSession.full_transcript.substring(0, 100) + '...');
                        toast.success(`Session enregistrée (${Math.floor(transcriptionSession.duration_seconds / 60)}min ${transcriptionSession.duration_seconds % 60}s)`);
                    } catch (saveError) {
                        console.error('❌ Erreur sauvegarde historique:', saveError);
                        toast.error("Erreur lors de la sauvegarde de l'historique");
                    }
                } else {
                    console.log('📚 Aucune transcription à sauvegarder (session vide)');
                    toast.info("Session vide - aucun historique créé");
                }
                
                // Aussi notifier le serveur Node.js pour les admins
                if (socket) {
                    socket.emit('stop_streaming', {
                        commercial_id: user?.id
                    });
                    console.log('📡 COMMERCIAL - Notification arrêt envoyée au serveur Node.js');
                }
                
                toast.success("Streaming audio arrêté - Session sauvegardée");
            } else {
                console.log('🎤 COMMERCIAL PAGE - Démarrage du streaming...');
                
                // Réinitialiser la transcription avant de démarrer le NOUVEAU cycle
                console.log('🔄 COMMERCIAL - Réinitialisation transcription pour NOUVELLE session');
                deepgramTranscription.clearTranscription();
                
                // Générer un ID unique pour cette nouvelle session
                const newSessionId = crypto.randomUUID();
                console.log('🆕 COMMERCIAL - Démarrage NOUVELLE session:', newSessionId);
                
                await audioStreaming.startStreaming();
                
                // Démarrer aussi la transcription avec l'ID utilisateur et le socket
                console.log('🎙️ COMMERCIAL PAGE - Démarrage transcription...');
                console.log('🎙️ COMMERCIAL PAGE - User ID:', user?.id);
                console.log('🎙️ COMMERCIAL PAGE - Socket disponible:', !!socket);
                console.log('🎙️ COMMERCIAL PAGE - Socket connecté:', socket?.connected);
                
                // Utiliser la même connexion Socket.IO que pour le streaming audio
                await deepgramTranscription.startTranscription(user?.id, socket);
                
                // S'assurer que nous sommes bien dans la room dédiée aux transcriptions
                if (socket?.connected) {
                    socket.emit('joinRoom', 'transcriptions');
                    console.log('🎙️ COMMERCIAL PAGE - Joint la room transcriptions');
                } else {
                    console.warn('⚠️ COMMERCIAL PAGE - Socket non connecté, impossible de rejoindre la room');
                }
                
                console.log('🎙️ COMMERCIAL PAGE - Transcription démarrée!');
                
                // Aussi notifier le serveur Node.js pour les admins
                if (socket) {
                    socket.emit('start_streaming', {
                        commercial_id: user?.id,
                        commercial_info: {
                            name: user?.nom || '',
                            role: 'commercial'
                        }
                    });
                    console.log('📡 COMMERCIAL - Notification démarrage envoyée au serveur Node.js');
                }
                
                toast.success("Streaming audio démarré - Vos supérieurs peuvent maintenant vous écouter");
            }
        } catch (error) {
            console.error('❌ COMMERCIAL PAGE - Erreur streaming:', error);
            toast.error("Erreur lors du basculement du streaming");
        }
    };

    const renderAudioStreamingPanel = () => {
        return (
            <div className="fixed bottom-6 right-6 z-50">
                {/* Bulle d'informations flottante */}
                {(audioStreaming.isStreaming || audioStreaming.error || !audioStreaming.isConnected) && (
                    <div className="mb-3 mr-2">
                        <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-xs">
                            {/* Triangle pointer vers le bouton */}
                            <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-white border-r border-b border-gray-200 transform rotate-45"></div>
                            
                            {audioStreaming.isStreaming && (
                                <div className="text-xs text-green-700 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                    <span className="font-medium">LIVE - Conversations partagées</span>
                                </div>
                            )}
                            
                            {!audioStreaming.isConnected && (
                                <div className="text-xs text-gray-600 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    <span>Connexion en cours...</span>
                                </div>
                            )}
                            
                            {audioStreaming.error && (
                                <div className="text-xs text-red-600 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <span>Erreur de connexion</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Bouton microphone flottant */}
                <button
                    onClick={handleToggleStreaming}
                    disabled={!audioStreaming.isConnected}
                    className={`
                        relative w-16 h-16 rounded-full shadow-lg transition-all duration-300 
                        flex items-center justify-center group
                        ${audioStreaming.isStreaming 
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                            : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
                        }
                        ${!audioStreaming.isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}
                        ${audioStreaming.isStreaming ? 'animate-pulse' : ''}
                    `}
                >
                    {audioStreaming.isStreaming ? (
                        <MicOff className="h-7 w-7 text-white" />
                    ) : (
                        <Mic className="h-7 w-7 text-white" />
                    )}
                    
                    {/* Badge LIVE */}
                    {audioStreaming.isStreaming && (
                        <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            LIVE
                        </div>
                    )}
                    
                    {/* Indicateur de connexion */}
                    <div className={`
                        absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800
                        ${audioStreaming.isConnected ? 'bg-green-500' : 'bg-gray-400'}
                    `}></div>
                </button>
            </div>
        );
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
            {renderAudioStreamingPanel()}
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
