import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Label } from '@/components/ui-admin/label';
import { User, Users, ArrowRight, Send, Loader2, ArrowLeft, Building, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { commercialService, type CommercialFromAPI } from '@/services/commercial.service';
import { prospectionService } from '@/services/prospection.service';
import { immeubleService, type ImmeubleFromApi } from '@/services/immeuble.service';
import { toast } from 'sonner';
import { Modal } from '@/components/ui-admin/Modal';
import { motion } from 'framer-motion';
import { Combobox } from '@/components/ui-admin/Combobox';
import { Skeleton } from '@/components/ui-admin/skeleton';
import { useSocket } from '@/hooks/useSocket';

type ProspectingMode = 'SOLO' | 'DUO';

const PageSkeleton = () => (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="space-y-8 animate-pulse max-w-3xl mx-auto">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-40 w-full rounded-2xl" />
                    <Skeleton className="h-40 w-full rounded-2xl" />
                </div>
            </div>
            <Skeleton className="h-14 w-full rounded-lg" />
        </div>
    </div>
);

const ProspectingSetupPage = () => {
    const { buildingId } = useParams<{ buildingId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [immeuble, setImmeuble] = useState<ImmeubleFromApi | null>(null);
    const [mode, setMode] = useState<ProspectingMode | null>(null);
    const [commercials, setCommercials] = useState<CommercialFromAPI[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingInvitation, setIsSendingInvitation] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const socket = useSocket();

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!buildingId || !user?.id) return;
            try {
                setIsLoading(true);
                const [immeubleData, commercialsData] = await Promise.all([
                    immeubleService.getImmeubleDetails(buildingId),
                    commercialService.getCommerciaux(),
                ]);
                setImmeuble(immeubleData);
                setCommercials(commercialsData.filter(c => c.id !== user.id));
            } catch (error) {
                toast.error("Erreur lors du chargement des données.");
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [buildingId, user]);

    // WebSocket pour les invitations DUO
    useEffect(() => {
        if (!socket || !user) return;

        // Se connecter au système DUO
        socket.emit('duo_user_connected', {
            userId: user.id,
            userInfo: {
                nom: user.nom || user.name,
                prenom: user.name
            }
        });

        // Écouter les réponses d'invitations
        const handleInvitationAnswered = (data: {
            requestId: string;
            accepted: boolean;
            responderName?: string;
            responderPrenom?: string;
        }) => {
            console.log('Réponse invitation reçue:', data);
            setIsSendingInvitation(false);
            
            if (data.accepted) {
                toast.success(`Invitation acceptée par ${data.responderPrenom} ${data.responderName} ! Redirection...`);
                navigate(`/commercial/prospecting/doors/${buildingId}`);
            } else {
                toast.warning(`Invitation refusée par ${data.responderPrenom} ${data.responderName}.`);
            }
        };

        // Écouter la confirmation d'envoi
        const handleInvitationDelivered = (data: {
            requestId: string;
            delivered: boolean;
            message: string;
        }) => {
            console.log('Confirmation envoi:', data);
            if (!data.delivered) {
                toast.warning(data.message);
            }
        };

        socket.on('duo_invitation_answered', handleInvitationAnswered);
        socket.on('duo_invitation_delivered', handleInvitationDelivered);

        return () => {
            socket.off('duo_invitation_answered', handleInvitationAnswered);
            socket.off('duo_invitation_delivered', handleInvitationDelivered);
        };
    }, [socket, user, navigate, buildingId]);

    const handleStartProspection = async () => {
        if (!user?.id || !buildingId || !mode) return;

        if (mode === 'DUO' && !selectedPartnerId) {
            toast.error("Veuillez sélectionner un coéquipier.");
            return;
        }

        if (mode === 'DUO') {
            if (!socket) {
                toast.error("Connexion WebSocket non disponible.");
                return;
            }

            setIsSendingInvitation(true);
            abortControllerRef.current = new AbortController();
            try {
                // 1. Appel API REST pour créer la demande en base
                const response = await prospectionService.startProspection({
                    commercialId: user.id,
                    immeubleId: buildingId,
                    mode: 'DUO',
                    partnerId: selectedPartnerId!,
                }, abortControllerRef.current.signal);

                // 2. Envoyer notification WebSocket instantanée
                const selectedCommercial = commercials.find(c => c.id === selectedPartnerId);
                socket.emit('duo_invitation_sent', {
                    requestId: response.requestId,
                    partnerId: selectedPartnerId,
                    requesterName: user.nom || user.name,
                    requesterPrenom: user.name,
                    immeubleAdresse: immeuble?.adresse || 'Adresse inconnue',
                    immeubleVille: immeuble?.ville || 'Ville inconnue',
                    immeubleId: buildingId
                });

                toast.success(`Invitation envoyée à ${selectedCommercial?.prenom} ${selectedCommercial?.nom} !`);
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    toast.error(error.response?.data?.message || "Erreur d'envoi.");
                    setIsSendingInvitation(false);
                }
            } finally {
                abortControllerRef.current = null;
            }
        } else { // Mode SOLO
            try {
                await prospectionService.startProspection({ commercialId: user.id, immeubleId: buildingId, mode: 'SOLO' });
                toast.success("Prospection démarrée !");
                navigate(`/commercial/prospecting/doors/${buildingId}`);
            } catch (error: any) {
                toast.error(error.response?.data?.message || "Erreur de démarrage.");
            }
        }
    };

    const handleCancelInvitation = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setIsSendingInvitation(false);
        toast.info("Invitation annulée.");
    };

    if (isLoading) return <PageSkeleton />;
    if (!immeuble) return <div className="text-center py-10">Immeuble non trouvé.</div>;

    const commercialOptions = commercials.map(c => ({ value: c.id, label: `${c.prenom} ${c.nom}` }));

    return (
        <div className="bg-gray-50 min-h-screen">
            <motion.div 
                className="space-y-8 max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 pb-24"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Button variant="outline" onClick={() => navigate('/commercial/prospecting')} className="bg-white shadow-sm">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la sélection
                </Button>

                <Card className="rounded-2xl shadow-lg border-none">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-gray-800 flex items-start gap-4">
                            <Building className="h-8 w-8 text-primary" />
                            <span>{immeuble.adresse}</span>
                        </CardTitle>
                        <CardDescription className="text-base text-gray-600 flex items-center gap-2 pt-1">
                            <MapPin className="h-4 w-4" />
                            {immeuble.ville}, {immeuble.codePostal}
                        </CardDescription>
                    </CardHeader>
                </Card>

                <Card className="rounded-2xl shadow-lg border-none">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-gray-800">Mode de Prospection</CardTitle>
                        <CardDescription>Comment souhaitez-vous prospecter cet immeuble ?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                                <Card 
                                    onClick={() => setMode('SOLO')}
                                    className={cn(
                                        "p-6 text-center cursor-pointer transition-all border-2 rounded-xl",
                                        mode === 'SOLO' ? 'border-blue-500 bg-blue-50 shadow-xl' : 'bg-white hover:border-blue-400'
                                    )}
                                >
                                    <User className="mx-auto h-12 w-12 text-blue-600" />
                                    <h3 className="mt-4 text-lg font-bold text-gray-800">Mode Solo</h3>
                                    <p className="text-sm text-gray-600">Prospectez seul à votre rythme.</p>
                                </Card>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                                <Card 
                                    onClick={() => setMode('DUO')}
                                    className={cn(
                                        "p-6 text-center cursor-pointer transition-all border-2 rounded-xl",
                                        mode === 'DUO' ? 'border-purple-500 bg-purple-50 shadow-xl' : 'bg-white hover:border-purple-400'
                                    )}
                                >
                                    <Users className="mx-auto h-12 w-12 text-purple-600" />
                                    <h3 className="mt-4 text-lg font-bold text-gray-800">Mode Duo</h3>
                                    <p className="text-sm text-gray-600">Collaborez avec un coéquipier.</p>
                                </Card>
                            </motion.div>
                        </div>

                        {mode === 'DUO' && (
                            <motion.div className="space-y-4 pt-4 border-t" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <Label htmlFor="partner-select" className="font-semibold text-gray-700">Sélectionnez un coéquipier</Label>
                                <Combobox
                                    options={commercialOptions}
                                    value={selectedPartnerId || ''}
                                    onChange={setSelectedPartnerId}
                                    placeholder="Rechercher un commercial..."
                                    emptyMessage="Aucun commercial trouvé."
                                />
                            </motion.div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end mt-8">
                    <Button 
                        onClick={handleStartProspection}
                        disabled={!mode || (mode === 'DUO' && !selectedPartnerId)}
                        size="lg"
                        className="w-full md:w-auto font-bold py-3 px-8 rounded-lg text-white transition-all duration-300 flex items-center gap-2 bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        <span>{mode === 'DUO' ? 'Envoyer l\'invitation' : 'Démarrer la Prospection'}</span>
                        {mode === 'DUO' ? <Send className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                    </Button>
                </div>
            </motion.div>

            <Modal isOpen={isSendingInvitation} onClose={() => {}} title="En attente de réponse..." maxWidth="max-w-sm">
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
                    <p className="text-lg font-semibold text-gray-800">Invitation envoyée !</p>
                    <p className="text-gray-600 mb-6">En attente de l'acceptation de votre coéquipier.</p>
                    <Button variant="outline" onClick={handleCancelInvitation}>Annuler l'invitation</Button>
                </div>
            </Modal>
        </div>
    );
};

export default ProspectingSetupPage;
