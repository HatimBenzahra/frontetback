// frontend-shadcn/src/pages/admin/immeubles/portes/ImmeubleDetailsPage.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    ArrowLeft, Building, Users, Check, MoveUpRight, KeyRound, 
    RefreshCw, Search, Filter, User, Smile, Frown, 
    Landmark, BellOff, Repeat, MessageSquare, Hash, Edit, Plus, Trash2,
    ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
    DoorOpen, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui-admin/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Skeleton } from '@/components/ui-admin/skeleton';
import { ScrollArea } from '@/components/ui-admin/scroll-area';
import { Input } from '@/components/ui-admin/input';
import { Badge } from '@/components/ui-admin/badge';
import { Modal } from '@/components/ui-admin/Modal';
import { Label } from '@/components/ui-admin/label';
import { Textarea } from '@/components/ui-admin/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { GenericRadialBarChart } from '@/components/ui-admin/GenericRadialBarChart';
import { immeubleService } from '@/services/immeuble.service';
import { porteService } from '@/services/porte.service';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

// Types
interface Prospector {
    id: string;
    nom: string;
}

interface Porte {
    id: string;
    numeroPorte: string;
    statut: PorteStatus;
    passage: number;
    commentaire: string | null;
    etage: number;
    assigneeId: string | null;
    lastUpdated?: string;
}

type PorteStatus = "NON_VISITE" | "ABSENT" | "REFUS" | "CURIEUX" | "RDV" | "CONTRAT_SIGNE";

interface ImmeubleDetails {
    id: string;
    adresse: string;
    ville: string;
    codePostal: string;
    prospectors: Prospector[];
    prospectingMode: 'SOLO' | 'DUO';
    hasElevator: boolean;
    digicode: string | null;
    nbPortesTotal: number;
    nbEtages: number;
    nbPortesParEtage: number;
    portes: Porte[];
    stats: {
        contratsSignes: number;
        rdvPris: number;
    };
}

// Fonctions utilitaires pour les couleurs des statuts
const getStatusBgColor = (status: PorteStatus): string => {
    switch (status) {
        case "NON_VISITE": return "bg-gray-100";
        case "ABSENT": return "bg-yellow-100";
        case "CURIEUX": return "bg-purple-100";
        case "REFUS": return "bg-red-100";
        case "RDV": return "bg-sky-100";
        case "CONTRAT_SIGNE": return "bg-emerald-100";
        default: return "bg-gray-100";
    }
};

const getStatusIconColor = (status: PorteStatus): string => {
    switch (status) {
        case "NON_VISITE": return "text-gray-600";
        case "ABSENT": return "text-yellow-600";
        case "CURIEUX": return "text-purple-600";
        case "REFUS": return "text-red-600";
        case "RDV": return "text-sky-600";
        case "CONTRAT_SIGNE": return "text-emerald-600";
        default: return "text-gray-600";
    }
};

const getStatusBarColor = (status: PorteStatus): string => {
    switch (status) {
        case "NON_VISITE": return "bg-gray-400";
        case "ABSENT": return "bg-yellow-500";
        case "CURIEUX": return "bg-purple-500";
        case "REFUS": return "bg-red-500";
        case "RDV": return "bg-sky-500";
        case "CONTRAT_SIGNE": return "bg-emerald-500";
        default: return "bg-gray-400";
    }
};

// Configuration des statuts
const statusConfig: Record<PorteStatus, { 
    className: string; 
    icon: React.ElementType;
    badgeClassName: string;
    label: string;
    color: string;
}> = {
    "NON_VISITE": { 
        className: "text-gray-800", 
        icon: BellOff,
        badgeClassName: "bg-gray-100 text-gray-800 border border-gray-300",
        label: "Non visité",
        color: "gray"
    },
    "ABSENT": { 
        className: "text-yellow-800", 
        icon: User,
        badgeClassName: "bg-yellow-100 text-yellow-800 border border-yellow-300",
        label: "Absent",
        color: "yellow"
    },
    "CURIEUX": { 
        className: "text-purple-800", 
        icon: Smile,
        badgeClassName: "bg-purple-100 text-purple-800 border border-purple-300",
        label: "Curieux",
        color: "purple"
    },
    "REFUS": { 
        className: "text-red-800", 
        icon: Frown,
        badgeClassName: "bg-red-100 text-red-800 border border-red-300",
        label: "Refus",
        color: "red"
    },
    "RDV": { 
        className: "text-sky-800", 
        icon: Check,
        badgeClassName: "bg-sky-100 text-sky-800 border border-sky-300",
        label: "RDV",
        color: "sky"
    },
    "CONTRAT_SIGNE": { 
        className: "text-emerald-800", 
        icon: Landmark,
        badgeClassName: "bg-emerald-100 text-emerald-800 border border-emerald-300",
        label: "Signé",
        color: "emerald"
    },
};

// Composants UI
const ProspectorBadge = ({ Icon, label, prospectors }: { Icon: React.ElementType, label: string, prospectors: Prospector[] }) => (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 h-full shadow-sm hover:shadow-md transition-shadow">
        <div className="bg-blue-100 p-2 rounded-md"><Icon className="h-5 w-5 text-blue-600" /></div>
        <div className="flex flex-col gap-1.5">
            <div className="text-sm text-gray-600 font-medium">{label}</div>
            <div className="text-base font-semibold flex flex-col items-start">
                {prospectors.map(p => (
                    <Link key={p.id} to={`/admin/commerciaux/${p.id}`} className="hover:underline hover:text-blue-600 text-gray-900">
                        {p.nom}
                    </Link>
                ))}
            </div>
        </div>
    </div>
);

const InfoBadge = ({ Icon, label, value }: { Icon: React.ElementType, label: string, value: string | React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 h-full shadow-sm hover:shadow-md transition-shadow">
        <div className="bg-green-100 p-2 rounded-md"><Icon className="h-5 w-5 text-green-600" /></div>
        <div>
            <div className="text-sm text-gray-600 font-medium">{label}</div>
            <div className="text-base font-bold text-gray-900">{value}</div>
        </div>
    </div>
);

// Composant de ligne de porte
const PorteRow = ({ 
    porte, 
    onEdit, 
    onDelete,
    prospectors,
    isDuoMode 
}: { 
    porte: Porte; 
    onEdit: (porte: Porte) => void;
    onDelete: (porte: Porte) => void;
    prospectors: Prospector[];
    isDuoMode: boolean;
}) => {
    const config = statusConfig[porte.statut];
    const assignee = prospectors.find(p => p.id === porte.assigneeId);
    
    const getRepassageStatus = () => {
        const noRepassageStatuses: PorteStatus[] = ["NON_VISITE", "CONTRAT_SIGNE", "REFUS"];
        if (noRepassageStatuses.includes(porte.statut)) return null;
        
        if (porte.passage < 3) {
            return { type: 'warning', text: 'À revoir', icon: Repeat };
        } else {
            return { type: 'danger', text: 'Non intéressé', icon: Repeat };
        }
    };

    const repassageStatus = getRepassageStatus();

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-12 gap-4 items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors bg-white"
        >
            {/* Numéro de porte */}
            <div className="col-span-2 flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{porte.numeroPorte}</span>
            </div>

            {/* Statut */}
            <div className="col-span-2">
                <Badge className={cn("font-medium", config.badgeClassName)}>
                    <config.icon className="mr-1.5 h-3 w-3" />
                    {config.label}
                </Badge>
            </div>

            {/* Assigné (mode duo) */}
            {isDuoMode && (
                <div className="col-span-2">
                    {assignee ? (
                        <span className="text-sm font-medium text-blue-600">{assignee.nom}</span>
                    ) : (
                        <span className="text-sm text-muted-foreground">Non assigné</span>
                    )}
                </div>
            )}

            {/* Passages */}
            <div className="col-span-1 text-center">
                <span className="font-medium">{porte.passage}</span>
            </div>

            {/* Repassage */}
            <div className="col-span-2">
                {repassageStatus ? (
                    <div className={cn(
                        "flex items-center gap-2 text-sm font-medium",
                        repassageStatus.type === 'warning' ? "text-yellow-600" : "text-red-600"
                    )}>
                        <repassageStatus.icon className="h-4 w-4" />
                        <span>{repassageStatus.text}</span>
                    </div>
                ) : (
                    <span className="text-muted-foreground">-</span>
                )}
            </div>

            {/* Commentaire */}
            <div className="col-span-3">
                {porte.commentaire ? (
                    <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                        <span className="text-sm line-clamp-2">{porte.commentaire}</span>
                    </div>
                ) : (
                    <span className="text-sm italic text-muted-foreground">Aucun commentaire</span>
                )}
            </div>

            {/* Actions */}
            <div className="col-span-2 flex justify-end gap-1">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEdit(porte)}
                    className="h-8 w-8 p-0"
                >
                    <Edit className="h-4 w-4" />
                </Button>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onDelete(porte)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </motion.div>
    );
};

// Modal d'édition
const EditPorteModal = ({ 
    porte, 
    isOpen, 
    onClose, 
    onSave,
    prospectors,
    isDuoMode 
}: { 
    porte: Porte | null; 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (porteId: string, updates: Partial<Porte>) => Promise<void>;
    prospectors: Prospector[];
    isDuoMode: boolean;
}) => {
    const [numeroPorte, setNumeroPorte] = useState(porte?.numeroPorte || "");
    const [status, setStatus] = useState<PorteStatus>(porte?.statut || "NON_VISITE");
    const [commentaire, setCommentaire] = useState(porte?.commentaire || "");
    const [assigneeId, setAssigneeId] = useState(porte?.assigneeId || "");
    const [loading, setLoading] = useState(false);
    


    useEffect(() => {
        if (porte) {
            setNumeroPorte(porte.numeroPorte);
            setStatus(porte.statut);
            setCommentaire(porte.commentaire || "");
            setAssigneeId(porte.assigneeId || "");
        }
    }, [porte]);

    const handleSave = async () => {
        if (!porte) return;
        
        if (!numeroPorte.trim()) {
            toast.error("Le numéro de porte est requis");
            return;
        }
        
        setLoading(true);
        try {
            await onSave(porte.id, {
                numeroPorte: numeroPorte.trim(),
                statut: status,
                commentaire: commentaire || null,
                assigneeId: assigneeId || null,
            });
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        } finally {
            setLoading(false);
        }
    };

    const currentStatusConfig = statusConfig[status];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Modifier la porte">
            <div className="space-y-6">
                {/* Header avec informations de la porte */}
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full">
                            <DoorOpen className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-blue-900">
                                Modification de la porte {porte?.numeroPorte}
                            </h3>
                            <p className="text-sm text-blue-700 mt-1">
                                Étage {porte?.etage} • {currentStatusConfig?.label}
                            </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${currentStatusConfig?.badgeClassName}`}>
                            <currentStatusConfig.icon className="h-4 w-4 inline mr-1" />
                            {currentStatusConfig?.label}
                        </div>
                    </div>
                </div>

                {/* Formulaire */}
                <div className="space-y-6">
                    {/* Numéro de porte */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold flex items-center gap-2">
                            <Hash className="h-4 w-4 text-gray-500" />
                            Numéro de porte *
                        </Label>
                        <Input 
                            value={numeroPorte}
                            onChange={(e) => setNumeroPorte(e.target.value)}
                            placeholder="Ex: Porte 1, A1, etc."
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-12 text-lg font-medium"
                        />
                    </div>

                    {/* Statut */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold flex items-center gap-2">
                            <Check className="h-4 w-4 text-gray-500" />
                            Statut de la porte
                        </Label>
                        <Select value={status} onValueChange={(value: PorteStatus) => setStatus(value)}>
                            <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-12">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(statusConfig).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-3 py-1">
                                            <div className={`p-1.5 rounded-md ${getStatusBgColor(key as PorteStatus)}`}>
                                                <config.icon className={`h-4 w-4 ${getStatusIconColor(key as PorteStatus)}`} />
                                            </div>
                                            <span className="font-medium">{config.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Assignation (mode duo) */}
                    {isDuoMode && (
                        <div className="space-y-2">
                            <Label className="text-gray-700 font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-500" />
                                Assigné à
                            </Label>
                            <Select value={assigneeId} onValueChange={setAssigneeId}>
                                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 h-12">
                                    <SelectValue placeholder="Sélectionner un prospecteur" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-md bg-gray-100">
                                                <User className="h-4 w-4 text-gray-500" />
                                            </div>
                                            <span>Non assigné</span>
                                        </div>
                                    </SelectItem>
                                    {prospectors.map(prospector => (
                                        <SelectItem key={prospector.id} value={prospector.id}>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-md bg-blue-100">
                                                    <User className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <span>{prospector.nom}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Commentaire */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            Commentaire
                        </Label>
                        <Textarea
                            value={commentaire}
                            onChange={(e) => setCommentaire(e.target.value)}
                            placeholder="Ajouter un commentaire sur cette porte..."
                            rows={4}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
                        />
                        <p className="text-xs text-gray-500">
                            Décrivez les détails de la visite, les remarques importantes, etc.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 pb-6">
                    <Button 
                        variant="outline" 
                        onClick={onClose}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 h-11 px-6"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white h-11 px-6 shadow-md"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Sauvegarde...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                Sauvegarder
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Modal d'ajout de porte
const AddPorteModal = ({ 
    isOpen, 
    onClose, 
    onSave,
    prospectors,
    isDuoMode,
    nbEtages,
    activeFloor
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (porteData: { numeroPorte: string; etage: number; statut: PorteStatus; assigneeId?: string }) => Promise<void>;
    prospectors: Prospector[];
    isDuoMode: boolean;
    nbEtages: number;
    activeFloor: number | null;
}) => {
    const [numeroPorte, setNumeroPorte] = useState("");
    const [etage, setEtage] = useState(activeFloor || 1);
    const [statut, setStatut] = useState<PorteStatus>("NON_VISITE");
    const [assigneeId, setAssigneeId] = useState("");
    const [loading, setLoading] = useState(false);

    // Mettre à jour l'étage quand activeFloor change
    useEffect(() => {
        if (activeFloor) {
            setEtage(activeFloor);
        }
    }, [activeFloor]);

    const handleSave = async () => {
        if (!numeroPorte.trim()) {
            toast.error("Le numéro de porte est requis");
            return;
        }
        
        setLoading(true);
        try {
            await onSave({
                numeroPorte: numeroPorte.trim(),
                etage,
                statut,
                assigneeId: assigneeId || undefined,
            });
            // Reset form
            setNumeroPorte("");
            setEtage(1);
            setStatut("NON_VISITE");
            setAssigneeId("");
        } catch (error) {
            // Error handled by parent
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une porte">
            <div className="space-y-6">
                {/* Header avec informations */}
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full">
                            <DoorOpen className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-900">
                                Ajouter une nouvelle porte
                            </h3>
                            <p className="text-sm text-green-700 mt-1">
                                Créer une nouvelle porte pour la prospection
                            </p>
                        </div>
                        <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                            <Plus className="h-4 w-4 inline mr-1" />
                            Nouvelle porte
                        </div>
                    </div>
                </div>

                {/* Formulaire */}
                <div className="space-y-6">
                    {/* Numéro de porte */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold flex items-center gap-2">
                            <Hash className="h-4 w-4 text-gray-500" />
                            Numéro de porte *
                        </Label>
                        <Input
                            value={numeroPorte}
                            onChange={(e) => setNumeroPorte(e.target.value)}
                            placeholder="Ex: Porte 1, A1, etc."
                            className="border-gray-300 focus:border-green-500 focus:ring-green-500 h-12 text-lg font-medium"
                        />
                    </div>

                    {/* Étage */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-500" />
                            Étage
                        </Label>
                        <Select value={etage.toString()} onValueChange={(value) => setEtage(parseInt(value))}>
                            <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500 h-12">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: nbEtages }, (_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-md bg-blue-100">
                                                <Building className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <span>Étage {i + 1}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Statut initial */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold flex items-center gap-2">
                            <Check className="h-4 w-4 text-gray-500" />
                            Statut initial
                        </Label>
                        <Select value={statut} onValueChange={(value: PorteStatus) => setStatut(value)}>
                            <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500 h-12">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(statusConfig).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-3 py-1">
                                            <div className={`p-1.5 rounded-md ${getStatusBgColor(key as PorteStatus)}`}>
                                                <config.icon className={`h-4 w-4 ${getStatusIconColor(key as PorteStatus)}`} />
                                            </div>
                                            <span className="font-medium">{config.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Assignation (mode duo) */}
                    {isDuoMode && (
                        <div className="space-y-2">
                            <Label className="text-gray-700 font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-500" />
                                Assigné à (optionnel)
                            </Label>
                            <Select value={assigneeId} onValueChange={setAssigneeId}>
                                <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500 h-12">
                                    <SelectValue placeholder="Sélectionner un prospecteur" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-md bg-gray-100">
                                                <User className="h-4 w-4 text-gray-500" />
                                            </div>
                                            <span>Non assigné</span>
                                        </div>
                                    </SelectItem>
                                    {prospectors.map(prospector => (
                                        <SelectItem key={prospector.id} value={prospector.id}>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-md bg-blue-100">
                                                    <User className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <span>{prospector.nom}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 pb-6">
                    <Button 
                        variant="outline" 
                        onClick={onClose}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 h-11 px-6"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={loading || !numeroPorte.trim()}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-11 px-6 shadow-md"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Ajout en cours...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter la porte
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Modal d'ajout d'étage
const AddFloorModal = ({ 
    isOpen, 
    onClose, 
    onSave,
    currentNbEtages
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: () => Promise<void>;
    currentNbEtages: number;
}) => {
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave();
        } catch (error) {
            // Error handled by parent
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un étage">
            <div className="space-y-6">
                {/* Header avec informations */}
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full">
                            <Building className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-900">
                                Ajouter un nouvel étage
                            </h3>
                            <p className="text-sm text-green-700 mt-1">
                                Étendre la capacité de prospection de l'immeuble
                            </p>
                        </div>
                        <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                            <Plus className="h-4 w-4 inline mr-1" />
                            Nouvel étage
                        </div>
                    </div>
                </div>

                {/* Informations détaillées */}
                <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-md mt-0.5">
                                <Building className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-blue-900 mb-1">
                                    Étage {currentNbEtages + 1}
                                </h4>
                                <p className="text-sm text-blue-700">
                                    Vous êtes sur le point d'ajouter l'étage {currentNbEtages + 1} à cet immeuble.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 rounded-md mt-0.5">
                                <DoorOpen className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-amber-900 mb-1">
                                    Portes automatiques
                                </h4>
                                <p className="text-sm text-amber-700">
                                    L'étage sera créé avec 10 nouvelles portes prêtes pour la prospection.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-100 rounded-md mt-0.5">
                                <Check className="h-4 w-4 text-purple-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-purple-900 mb-1">
                                    Configuration
                                </h4>
                                <p className="text-sm text-purple-700">
                                    Toutes les portes seront initialisées avec le statut "Non visité" et pourront être assignées aux prospecteurs.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 pb-6">
                    <Button 
                        variant="outline" 
                        onClick={onClose}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 h-11 px-6"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-11 px-6 shadow-md"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Ajout en cours...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter l'étage
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Modal de confirmation de suppression
const DeletePorteModal = ({ 
    porte, 
    isOpen, 
    onClose, 
    onConfirm
}: { 
    porte: Porte | null; 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: (porte: Porte) => Promise<void>;
}) => {
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!porte) return;
        
        setLoading(true);
        try {
            await onConfirm(porte);
        } catch (error) {
            // Error handled by parent
        } finally {
            setLoading(false);
        }
    };

    if (!porte) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Supprimer la porte">
            <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-red-600" />
                        <span className="text-sm text-red-800 font-medium">
                            Êtes-vous sûr de vouloir supprimer cette porte ?
                        </span>
                    </div>
                    <div className="mt-2 text-sm text-red-700">
                        <p><strong>Porte :</strong> {porte.numeroPorte}</p>
                        <p><strong>Étage :</strong> {porte.etage}</p>
                        <p><strong>Statut :</strong> {statusConfig[porte.statut].label}</p>
                    </div>
                    <p className="text-xs text-red-600 mt-2">
                        Cette action est irréversible et supprimera définitivement la porte et toutes ses données associées.
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={onClose}>
                        Annuler
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleConfirm} 
                        disabled={loading}
                        className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white"
                    >
                        {loading ? "Suppression..." : "Supprimer"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const ImmeubleDetailsPage = () => {
    const { immeubleId } = useParams<{ immeubleId: string }>();
    const navigate = useNavigate();
    const socket = useSocket(immeubleId);
    
    const [immeuble, setImmeuble] = useState<ImmeubleDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeFloor, setActiveFloor] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<PorteStatus | "ALL">("ALL");
    const [sortBy, setSortBy] = useState<"numero" | "statut" | "passage">("numero");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [editingPorte, setEditingPorte] = useState<Porte | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddPorteModalOpen, setIsAddPorteModalOpen] = useState(false);
    const [isAddFloorModalOpen, setIsAddFloorModalOpen] = useState(false);
    const [porteToDelete, setPorteToDelete] = useState<Porte | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isStatusChangeWarningOpen, setIsStatusChangeWarningOpen] = useState(false);
    const [pendingPorteUpdate, setPendingPorteUpdate] = useState<{ porteId: string; updates: Partial<Porte> } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isAddingPorte, setIsAddingPorte] = useState(false);

    // Calcul des statistiques
    const buildingStats = useMemo(() => {
        if (!immeuble || !immeuble.portes) {
            return { contratsSignes: 0, rdvPris: 0 };
        }

        const contratsSignes = immeuble.portes.filter(p => p.statut === "CONTRAT_SIGNE").length;
        const rdvPris = immeuble.portes.filter(p => p.statut === "RDV").length;

        return { contratsSignes, rdvPris };
    }, [immeuble]);

    // Groupement des portes par étage
    const portesGroupedByFloor = useMemo(() => {
        if (!immeuble) return {};

        const grouped: { [key: number]: Porte[] } = {};
        for (let i = 1; i <= immeuble.nbEtages; i++) {
            grouped[i] = [];
        }

        immeuble.portes.forEach(porte => {
            if (grouped[porte.etage]) {
                grouped[porte.etage].push(porte);
            } else {
                grouped[porte.etage] = [porte];
            }
        });

        return grouped;
    }, [immeuble]);

    // Filtrage et tri des portes
    const filteredAndSortedPortes = useMemo(() => {
        if (!activeFloor || !portesGroupedByFloor[activeFloor]) return [];

        let portes = portesGroupedByFloor[activeFloor];

        // Filtrage par recherche
        if (searchTerm) {
            portes = portes.filter(porte => 
                porte.numeroPorte.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (porte.commentaire && porte.commentaire.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Filtrage par statut
        if (statusFilter !== "ALL") {
            portes = portes.filter(porte => porte.statut === statusFilter);
        }

        // Tri
        portes.sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            switch (sortBy) {
                case "numero":
                    aValue = parseInt(a.numeroPorte);
                    bValue = parseInt(b.numeroPorte);
                    break;
                case "statut":
                    aValue = a.statut;
                    bValue = b.statut;
                    break;
                case "passage":
                    aValue = a.passage;
                    bValue = b.passage;
                    break;
                default:
                    return 0;
            }

            if (sortOrder === "asc") {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        return portes;
    }, [activeFloor, portesGroupedByFloor, searchTerm, statusFilter, sortBy, sortOrder]);

    // Calcul du taux de couverture
    const portesProspectees = useMemo(() => 
        immeuble?.portes.filter(p => p.statut !== "NON_VISITE").length || 0, 
        [immeuble?.portes]
    );
    const totalPortes = useMemo(() => 
        immeuble?.portes.length || 0, 
        [immeuble?.portes]
    );
    const tauxCouverture = useMemo(() => 
        totalPortes > 0 ? ((portesProspectees / totalPortes) * 100) : 0, 
        [portesProspectees, totalPortes]
    );

    // Pagination
    const totalPages = Math.ceil(filteredAndSortedPortes.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedPortes = filteredAndSortedPortes.slice(startIndex, endIndex);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, activeFloor]);

    // Écoute des événements WebSocket pour la synchronisation en temps réel
    useEffect(() => {
        if (!socket) return;

        const handlePorteUpdate = (data: { porteId: string; updates: Partial<Porte> }) => {
            setImmeuble(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    portes: prev.portes.map(porte => 
                        porte.id === data.porteId 
                            ? { ...porte, ...data.updates, lastUpdated: new Date().toISOString() }
                            : porte
                    )
                };
            });
        };

        const handlePorteStatusChange = (data: { porteId: string; statut: PorteStatus; assigneeId?: string }) => {
            setImmeuble(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    portes: prev.portes.map(porte => 
                        porte.id === data.porteId 
                            ? { 
                                ...porte, 
                                statut: data.statut, 
                                assigneeId: data.assigneeId || porte.assigneeId,
                                lastUpdated: new Date().toISOString() 
                            }
                            : porte
                    )
                };
            });
        };

        const handlePorteAdded = (data: { porte: Porte }) => {
            setImmeuble(prev => {
                if (!prev) return prev;
                // Vérifier si la porte existe déjà pour éviter les doublons
                const porteExists = prev.portes.some(p => p.id === data.porte.id);
                if (porteExists) {
                    return prev;
                }
                return {
                    ...prev,
                    portes: [...prev.portes, data.porte],
                    nbPortesTotal: prev.nbPortesTotal + 1
                };
            });
        };

        const handlePorteDeleted = (data: { porteId: string }) => {
            setImmeuble(prev => {
                if (!prev) return prev;
                const updatedPortes = prev.portes.filter(p => p.id !== data.porteId);
                return {
                    ...prev,
                    portes: updatedPortes,
                    nbPortesTotal: updatedPortes.length
                };
            });
        };

        const handleFloorAdded = (data: { newNbEtages: number }) => {
            setImmeuble(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    nbEtages: data.newNbEtages
                };
            });
        };

        socket.on('porte:updated', handlePorteUpdate);
        socket.on('porte:statusChanged', handlePorteStatusChange);
        socket.on('porte:added', handlePorteAdded);
        socket.on('porte:deleted', handlePorteDeleted);
        socket.on('floor:added', handleFloorAdded);

        return () => {
            socket.off('porte:updated', handlePorteUpdate);
            socket.off('porte:statusChanged', handlePorteStatusChange);
            socket.off('porte:added', handlePorteAdded);
            socket.off('porte:deleted', handlePorteDeleted);
            socket.off('floor:added', handleFloorAdded);
        };
    }, [socket]);

    useEffect(() => {
        if (immeubleId) {
            fetchData(immeubleId);
        }
    }, [immeubleId]);

    useEffect(() => {
        if (immeuble && Object.keys(portesGroupedByFloor).length > 0 && activeFloor === null) {
            setActiveFloor(parseInt(Object.keys(portesGroupedByFloor)[0]));
        }
    }, [immeuble, portesGroupedByFloor, activeFloor]);

    const fetchData = async (id: string) => {
        setLoading(true);
        try {
            const detailsFromApi = await immeubleService.getImmeubleDetails(id);

            const formattedDetails: ImmeubleDetails = {
                id: detailsFromApi.id,
                adresse: detailsFromApi.adresse,
                ville: detailsFromApi.ville,
                codePostal: detailsFromApi.codePostal,
                prospectors: (detailsFromApi.prospectors || []).map(p => ({
                    id: p.id,
                    nom: `${p.prenom} ${p.nom}`
                })),
                prospectingMode: detailsFromApi.prospectingMode,
                hasElevator: detailsFromApi.hasElevator,
                digicode: detailsFromApi.digicode,
                nbPortesTotal: detailsFromApi.nbPortesTotal,
                nbEtages: detailsFromApi.nbEtages || 1,
                nbPortesParEtage: detailsFromApi.nbPortesParEtage || 10,
                portes: (detailsFromApi.portes || []).map(p => ({
                    id: p.id,
                    numeroPorte: p.numeroPorte,
                    statut: p.statut as PorteStatus,
                    passage: p.passage,
                    commentaire: p.commentaire || null,
                    etage: p.etage,
                    assigneeId: (p as any).assigneeId || null,
                })),
                stats: detailsFromApi.stats,
            };
            setImmeuble(formattedDetails);
        } catch (error) {
            console.error("Erreur de chargement des détails:", error);
            setImmeuble(null);
        } finally {
            setLoading(false);
        }
    };

    const handleEditPorte = (porte: Porte) => {
        setEditingPorte(porte);
        setIsEditModalOpen(true);
    };

    const handleSavePorte = async (porteId: string, updates: Partial<Porte>) => {
        // Vérifier si le statut a changé
        const porte = immeuble?.portes.find(p => p.id === porteId);
        const hasStatusChanged = porte && updates.statut && updates.statut !== porte.statut;
        
        // Si le statut a changé, afficher la modal de warning
        if (hasStatusChanged) {
            setPendingPorteUpdate({ porteId, updates });
            setIsStatusChangeWarningOpen(true);
            // Fermer la modal d'édition
            setIsEditModalOpen(false);
            setEditingPorte(null);
            return;
        }
        
        // Sinon, procéder directement à la mise à jour
        await executePorteUpdate(porteId, updates);
    };

    const executePorteUpdate = async (porteId: string, updates: Partial<Porte>) => {
        try {
            // Convertir les types pour correspondre à l'API
            const apiUpdates = {
                ...updates,
                commentaire: updates.commentaire === null ? undefined : updates.commentaire,
                assigneeId: updates.assigneeId === null ? undefined : updates.assigneeId,
            };
            
            await porteService.updatePorte(porteId, apiUpdates);
            
            // Mise à jour locale
            setImmeuble(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    portes: prev.portes.map(porte => 
                        porte.id === porteId 
                            ? { ...porte, ...updates, lastUpdated: new Date().toISOString() }
                            : porte
                    )
                };
            });

            // Émission WebSocket pour synchroniser avec les autres clients
            if (socket) {
                socket.emit('porte:update', { porteId, updates });
            }

            // Fermer le modal d'édition s'il est ouvert
            setIsEditModalOpen(false);
            setEditingPorte(null);
            
            toast.success("Porte mise à jour avec succès");
        } catch (error) {
            throw error;
        }
    };

    const handleSort = (column: "numero" | "statut" | "passage") => {
        if (sortBy === column) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(column);
            setSortOrder("asc");
        }
    };

    // Fonction pour calculer le prochain numéro de porte automatiquement
    const getNextPorteNumber = (etage: number) => {
        const portesOnFloor = portesGroupedByFloor[etage] || [];
        if (portesOnFloor.length === 0) return `${etage}01`;
        
        const maxNumber = Math.max(0, ...portesOnFloor.map(p => {
            const match = p.numeroPorte.match(/\d+/);
            return parseInt(match?.pop() || '0');
        }));
        
        return `${etage}${String(maxNumber + 1).padStart(2, '0')}`;
    };


    // CRUD Operations
    const handleAddPorte = async (porteData: { numeroPorte: string; etage: number; statut: PorteStatus; assigneeId?: string }) => {
        if (!immeubleId) return;
        
        try {
            const newPorte = await porteService.createPorte({
                ...porteData,
                passage: 0,
                immeubleId: immeubleId,
            });
            
            const newPorteFormatted = {
                id: newPorte.id,
                numeroPorte: newPorte.numeroPorte,
                statut: newPorte.statut as PorteStatus,
                passage: newPorte.passage,
                commentaire: newPorte.commentaire,
                etage: newPorte.etage,
                assigneeId: (newPorte as any).assigneeId || null,
            };
            
            // Mise à jour locale
            setImmeuble(prev => {
                if (!prev) return prev;
                // Vérifier si la porte existe déjà pour éviter les doublons
                const porteExists = prev.portes.some(p => p.id === newPorteFormatted.id);
                if (porteExists) {
                    return prev;
                }
                return {
                    ...prev,
                    portes: [...prev.portes, newPorteFormatted],
                    nbPortesTotal: prev.nbPortesTotal + 1
                };
            });

            // L'événement WebSocket est émis automatiquement par le backend
            // Pas besoin d'émettre côté frontend pour éviter la duplication

            setIsAddPorteModalOpen(false);
            toast.success("Porte ajoutée avec succès");
        } catch (error) {
            console.error("Erreur lors de l'ajout de la porte:", error);
            toast.error("Erreur lors de l'ajout de la porte");
        }
    };

    const handleDeletePorte = async (porte: Porte) => {
        try {
            await porteService.deletePorte(porte.id);
            
            // Mise à jour locale
            setImmeuble(prev => {
                if (!prev) return prev;
                const updatedPortes = prev.portes.filter(p => p.id !== porte.id);
                return {
                    ...prev,
                    portes: updatedPortes,
                    nbPortesTotal: updatedPortes.length
                };
            });

            // L'événement WebSocket est émis automatiquement par le backend
            // Pas besoin d'émettre côté frontend pour éviter la duplication

            setIsDeleteModalOpen(false);
            setPorteToDelete(null);
            toast.success("Porte supprimée avec succès");
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            toast.error("Erreur lors de la suppression");
        }
    };

    const handleAddFloor = async () => {
        if (!immeubleId || !immeuble) return;
        
        try {
            const newNbEtages = immeuble.nbEtages + 1;
            await immeubleService.updateImmeuble(immeubleId, {
                nbEtages: newNbEtages,
                nbPortesParEtage: immeuble.nbPortesParEtage,
            });
            
            // Mise à jour locale
            setImmeuble(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    nbEtages: newNbEtages
                };
            });

            // L'événement WebSocket est émis automatiquement par le backend
            // Pas besoin d'émettre côté frontend pour éviter la duplication
            
            setIsAddFloorModalOpen(false);
            toast.success("Étage ajouté avec succès");
        } catch (error) {
            console.error("Erreur lors de l'ajout de l'étage:", error);
            toast.error("Erreur lors de l'ajout de l'étage");
        }
    };

    // Fonction pour ajouter une porte directement depuis un étage
    const handleAddPorteFromFloor = async (etage: number) => {
        // Éviter les appels multiples
        if (!immeubleId || isAddingPorte) return;
        
        setIsAddingPorte(true);
        try {
            const nextNumero = getNextPorteNumber(etage);
            await handleAddPorte({
                numeroPorte: nextNumero,
                etage: etage,
                statut: "NON_VISITE"
            });
        } finally {
            setIsAddingPorte(false);
        }
    };

    if (loading) {
        return <AdminPageSkeleton hasHeader hasCards hasTable cardsCount={4} />;
    }
    
    if (!immeuble) {
        return (
            <div className="text-center p-8">
                <h2 className="text-xl font-semibold">Immeuble non trouvé</h2>
                <p className="text-muted-foreground mt-2">Les détails pour cet immeuble n'ont pas pu être chargés.</p>
                <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            {/* Header avec boutons */}
            <div className="flex flex-wrap justify-between items-center gap-2 mt-4 mb-6"> 
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour à la sélection de l'immeuble
                </Button>
            </div>
            
            {/* Informations de l'immeuble */}
            <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                    <CardTitle className="flex items-center gap-3 text-2xl text-gray-900">
                        <Building className="h-6 w-6 text-blue-600" />
                        Prospection : {immeuble.adresse}, {immeuble.codePostal} {immeuble.ville}
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                        Voici la liste des {immeuble.nbPortesTotal} portes à prospecter. 
                        {immeuble.prospectingMode === 'DUO' && ' Mode duo activé - les portes peuvent être assignées aux prospecteurs.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                   <ProspectorBadge 
                       Icon={Users} 
                       label={immeuble.prospectingMode === 'DUO' ? "Duo de Prospection" : "Prospecteur"} 
                       prospectors={immeuble.prospectors} 
                   />
                   <InfoBadge Icon={Check} label="Contrats Signés" value={buildingStats.contratsSignes} />
                   <InfoBadge Icon={MoveUpRight} label="RDV Pris" value={buildingStats.rdvPris} />
                   <InfoBadge Icon={KeyRound} label="Digicode" value={immeuble.digicode || "Aucun"} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tableau principal */}
                <div className="lg:col-span-2">
                    <Card className="bg-white border-gray-200 shadow-sm">
                        <CardHeader className="bg-gray-50 border-b border-gray-200">
                            <CardTitle className="text-gray-900">Détail des Portes</CardTitle>
                            <CardDescription className="text-gray-600">
                                Couverture: {portesProspectees} / {totalPortes} portes visitées ({tauxCouverture.toFixed(0)}%)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                                                                    {/* Sélection d'étage */}
                            <ScrollArea className="h-20 w-full rounded-md border border-gray-200 p-4 bg-white">
                                <div className="flex space-x-2 pb-2">
                                    {Object.keys(portesGroupedByFloor).sort((a, b) => parseInt(a) - parseInt(b)).map(floor => (
                                        <Button
                                            key={floor}
                                            variant={activeFloor === parseInt(floor) ? "secondary" : "outline"}
                                            onClick={() => setActiveFloor(parseInt(floor))}
                                            className={`flex-shrink-0 ${activeFloor === parseInt(floor) ? "bg-blue-600 text-white" : ""}`}
                                        >
                                            Étage {floor}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsAddFloorModalOpen(true)}
                                        className="flex-shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50"
                                    >
                                        <Plus className="mr-1 h-4 w-4" />
                                        Nouvel étage
                                    </Button>
                                </div>
                            </ScrollArea>

                            {activeFloor && (
                                <div className="space-y-4">
                                    {/* Filtres et recherche */}
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input
                                                placeholder="Rechercher par numéro ou commentaire..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                            />
                                        </div>
                                        <Select value={statusFilter} onValueChange={(value: PorteStatus | "ALL") => setStatusFilter(value)}>
                                            <SelectTrigger className="w-[180px] border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                                                <Filter className="mr-2 h-4 w-4 text-gray-400" />
                                                <SelectValue placeholder="Filtrer par statut" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">Tous les statuts</SelectItem>
                                                {Object.entries(statusConfig).map(([key, config]) => (
                                                    <SelectItem key={key} value={key}>
                                                        <div className="flex items-center gap-2">
                                                            <config.icon className="h-4 w-4" />
                                                            {config.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                    </div>

                                    {/* En-têtes du tableau */}
                                    <div className="grid grid-cols-12 gap-4 items-center p-4 bg-gray-100 rounded-lg font-medium text-sm border border-gray-200">
                                        <div className="col-span-2">
                                            <button 
                                                onClick={() => handleSort("numero")}
                                                className="flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Numéro
                                                {sortBy === "numero" && (
                                                    sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="col-span-2">
                                            <button 
                                                onClick={() => handleSort("statut")}
                                                className="flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Statut
                                                {sortBy === "statut" && (
                                                    sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        {immeuble.prospectingMode === 'DUO' && (
                                            <div className="col-span-2">Assigné à</div>
                                        )}
                                        <div className="col-span-1 text-center">
                                            <button 
                                                onClick={() => handleSort("passage")}
                                                className="flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Passages
                                                {sortBy === "passage" && (
                                                    sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="col-span-2">Repassage</div>
                                        <div className="col-span-3">Commentaire</div>
                                        <div className="col-span-2 text-right">Actions</div>
                                    </div>

                                    {/* Lignes du tableau */}
                                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                        <AnimatePresence>
                                            {paginatedPortes.length > 0 && (
                                                <>
                                                    {paginatedPortes.map((porte) => (
                                                        <PorteRow
                                                            key={porte.id}
                                                            porte={porte}
                                                            onEdit={handleEditPorte}
                                                            onDelete={(porte) => {
                                                                setPorteToDelete(porte);
                                                                setIsDeleteModalOpen(true);
                                                            }}
                                                            prospectors={immeuble.prospectors}
                                                            isDuoMode={immeuble.prospectingMode === 'DUO'}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                            
                                            {/* Ligne d'ajout de porte - toujours affichée */}
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 transition-all ${
                                                    isAddingPorte 
                                                        ? 'opacity-50 cursor-not-allowed' 
                                                        : 'hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                                                }`}
                                                onClick={() => !isAddingPorte && handleAddPorteFromFloor(activeFloor!)}
                                            >
                                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                                                    {isAddingPorte ? (
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                    ) : (
                                                        <Plus className="h-4 w-4 text-blue-600" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-700">
                                                        {isAddingPorte ? 'Ajout en cours...' : `Ajouter une porte à l'étage ${activeFloor}`}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        Numéro automatique: {getNextPorteNumber(activeFloor!)}
                                                    </div>
                                                </div>
                                            </motion.div>
                                            
                                            {/* Message si aucune porte et filtres actifs */}
                                            {paginatedPortes.length === 0 && (searchTerm || statusFilter !== "ALL") && (
                                                <div className="p-8 text-center text-muted-foreground">
                                                    Aucune porte trouvée avec les filtres actuels
                                                </div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white border-t border-gray-200">
                                            {/* Informations */}
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-gray-600 font-medium">
                                                    Affichage de <span className="text-gray-900 font-bold">{startIndex + 1}</span> à <span className="text-gray-900 font-bold">{Math.min(endIndex, filteredAndSortedPortes.length)}</span> sur <span className="text-gray-900 font-bold">{filteredAndSortedPortes.length}</span> résultats
                                                </span>
                                                
                                                {/* Sélecteur d'éléments par page */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600">Par page:</span>
                                                    <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                                                        setItemsPerPage(parseInt(value));
                                                        setCurrentPage(1);
                                                    }}>
                                                        <SelectTrigger className="w-16 h-8 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="5">5</SelectItem>
                                                            <SelectItem value="10">10</SelectItem>
                                                            <SelectItem value="20">20</SelectItem>
                                                            <SelectItem value="50">50</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* Navigation */}
                                            <div className="flex items-center gap-2">
                                                {/* Bouton Précédent */}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                    disabled={currentPage === 1}
                                                    className="h-8 px-3 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                                    Précédent
                                                </Button>

                                                {/* Numéros de page */}
                                                <div className="flex items-center gap-1">
                                                    {/* Première page */}
                                                    {currentPage > 3 && totalPages > 5 && (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setCurrentPage(1)}
                                                                className="w-8 h-8 p-0 border-gray-300 text-gray-700 hover:bg-gray-50"
                                                            >
                                                                1
                                                            </Button>
                                                            {currentPage > 4 && (
                                                                <span className="text-gray-400 px-1">...</span>
                                                            )}
                                                        </>
                                                    )}

                                                    {/* Pages autour de la page courante */}
                                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                        let pageNum;
                                                        if (totalPages <= 5) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage <= 3) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage >= totalPages - 2) {
                                                            pageNum = totalPages - 4 + i;
                                                        } else {
                                                            pageNum = currentPage - 2 + i;
                                                        }
                                                        
                                                        return (
                                                            <Button
                                                                key={pageNum}
                                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                                size="sm"
                                                                onClick={() => setCurrentPage(pageNum)}
                                                                className={`w-8 h-8 p-0 text-sm font-medium ${
                                                                    currentPage === pageNum 
                                                                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" 
                                                                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                                                }`}
                                                            >
                                                                {pageNum}
                                                            </Button>
                                                        );
                                                    })}

                                                    {/* Dernière page */}
                                                    {currentPage < totalPages - 2 && totalPages > 5 && (
                                                        <>
                                                            {currentPage < totalPages - 3 && (
                                                                <span className="text-gray-400 px-1">...</span>
                                                            )}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setCurrentPage(totalPages)}
                                                                className="w-8 h-8 p-0 border-gray-300 text-gray-700 hover:bg-gray-50"
                                                            >
                                                                {totalPages}
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Bouton Suivant */}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="h-8 px-3 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Suivant
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Statistiques de l'étage */}
                                    <div className="grid grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {filteredAndSortedPortes.length}
                                            </div>
                                            <div className="text-sm text-blue-600">Portes totales</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {filteredAndSortedPortes.filter(p => p.statut === "CONTRAT_SIGNE").length}
                                            </div>
                                            <div className="text-sm text-green-600">Contrats signés</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-sky-600">
                                                {filteredAndSortedPortes.filter(p => p.statut === "RDV").length}
                                            </div>
                                            <div className="text-sm text-sky-600">RDV pris</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-yellow-600">
                                                {filteredAndSortedPortes.filter(p => p.statut === "ABSENT").length}
                                            </div>
                                            <div className="text-sm text-yellow-600">Absents</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar avec graphiques */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Graphique de couverture - largeur complète */}
                    <Card className="w-full">
                        <CardContent className="p-6">
                            <GenericRadialBarChart
                                title="Taux de Couverture"
                                value={portesProspectees}
                                total={immeuble.nbPortesTotal}
                                color="fill-sky-500"
                            />
                        </CardContent>
                    </Card>

                    {/* Répartition par statut */}
                    <Card className="bg-white border-gray-200">
                        <CardHeader className="bg-gray-50 border-b border-gray-200">
                            <CardTitle className="text-lg text-gray-900">Répartition par statut</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="space-y-4">
                                {Object.entries(statusConfig).map(([status, config]) => {
                                    const count = immeuble.portes.filter(p => p.statut === status).length;
                                    const percentage = ((count / immeuble.nbPortesTotal) * 100).toFixed(1);
                                    const progressWidth = `${percentage}%`;
                                    
                                    return (
                                        <div key={status} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                                                        <div className={`p-2 rounded-lg ${getStatusBgColor(status as PorteStatus)}`}>
                                        <config.icon className={`h-4 w-4 ${getStatusIconColor(status as PorteStatus)}`} />
                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-gray-900">{config.label}</span>
                                                        <span className="text-xs text-gray-500">{count} portes</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-lg font-bold text-gray-900">{percentage}%</span>
                                                </div>
                                            </div>
                                            
                                            {/* Barre de progression */}
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full transition-all duration-300 ${getStatusBarColor(status as PorteStatus)}`}
                                                    style={{ width: progressWidth }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* Résumé en bas */}
                            <div className="mt-6 pt-4 border-t border-gray-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                                        <div className="text-2xl font-bold text-green-600">
                                            {immeuble.portes.filter(p => p.statut === "CONTRAT_SIGNE").length}
                                        </div>
                                        <div className="text-xs text-green-700 font-medium">Contrats signés</div>
                                    </div>
                                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {immeuble.portes.filter(p => p.statut === "RDV").length}
                                        </div>
                                        <div className="text-xs text-blue-700 font-medium">RDV pris</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modal d'édition */}
            <EditPorteModal
                porte={editingPorte}
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingPorte(null);
                }}
                onSave={handleSavePorte}
                prospectors={immeuble.prospectors}
                isDuoMode={immeuble.prospectingMode === 'DUO'}
            />

            {/* Modal d'ajout de porte */}
            <AddPorteModal
                isOpen={isAddPorteModalOpen}
                onClose={() => setIsAddPorteModalOpen(false)}
                onSave={handleAddPorte}
                prospectors={immeuble.prospectors}
                isDuoMode={immeuble.prospectingMode === 'DUO'}
                nbEtages={immeuble.nbEtages}
                activeFloor={activeFloor}
            />

            {/* Modal d'ajout d'étage */}
            <AddFloorModal
                isOpen={isAddFloorModalOpen}
                onClose={() => setIsAddFloorModalOpen(false)}
                onSave={handleAddFloor}
                currentNbEtages={immeuble.nbEtages}
            />

            {/* Modal de confirmation de suppression */}
            <DeletePorteModal
                porte={porteToDelete}
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setPorteToDelete(null);
                }}
                onConfirm={handleDeletePorte}
            />

            {/* Modal de warning pour changement de statut */}
            <Modal isOpen={isStatusChangeWarningOpen} onClose={() => setIsStatusChangeWarningOpen(false)} title="Attention : Modification du statut">
                <div className="space-y-6">
                    {/* Header avec warning */}
                    <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-100 rounded-full">
                                <Check className="h-6 w-6 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-amber-900">
                                    Modification du statut détectée
                                </h3>
                                <p className="text-sm text-amber-700 mt-1">
                                    Cette action va affecter les statistiques du commercial
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contenu du warning */}
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 rounded-md mt-0.5">
                                    <Check className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-blue-900 mb-1">
                                        Impact sur les statistiques
                                    </h4>
                                    <p className="text-sm text-blue-700">
                                        En modifiant le statut de cette porte, les statistiques du commercial qui l'a prospectée seront automatiquement mises à jour. Cette action peut affecter les performances affichées dans les tableaux de bord.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-purple-100 rounded-md mt-0.5">
                                    <Users className="h-4 w-4 text-purple-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-purple-900 mb-1">
                                        Commercial concerné
                                    </h4>
                                    <p className="text-sm text-purple-700">
                                        {immeuble?.prospectingMode === 'DUO' && pendingPorteUpdate ? (
                                            (() => {
                                                const porte = immeuble.portes.find(p => p.id === pendingPorteUpdate.porteId);
                                                const assignee = immeuble.prospectors.find(p => p.id === porte?.assigneeId);
                                                return assignee ? 
                                                    `Les statistiques de ${assignee.nom} seront mises à jour.` :
                                                    "Les statistiques du premier prospecteur seront mises à jour.";
                                            })()
                                        ) : (
                                            `Les statistiques de ${immeuble?.prospectors?.[0]?.nom || 'du prospecteur'} seront mises à jour.`
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 pb-6">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setIsStatusChangeWarningOpen(false);
                                setPendingPorteUpdate(null);
                            }}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 h-11 px-6"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Annuler
                        </Button>
                        <Button 
                            onClick={async () => {
                                if (pendingPorteUpdate) {
                                    await executePorteUpdate(pendingPorteUpdate.porteId, pendingPorteUpdate.updates);
                                    setIsStatusChangeWarningOpen(false);
                                    setPendingPorteUpdate(null);
                                }
                            }}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white h-11 px-6 shadow-md"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Confirmer la modification
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ImmeubleDetailsPage;