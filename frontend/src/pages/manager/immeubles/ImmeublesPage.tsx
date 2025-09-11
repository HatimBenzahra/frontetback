// frontend-shadcn/src/pages/manager/immeubles/ImmeublesPage.tsx

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Immeuble } from "./columns";
import { createColumns } from "./columns";
import type { Zone } from '../zones/columns';
import { DataTable } from "@/components/data-table/DataTable";
import { ImmeublesMap } from '../../../pages/admin/immeubles/ImmeublesMap';
import type { RowSelectionState } from "@tanstack/react-table";
import { ViewToggleContainer } from "@/components/ui-admin/ViewToggleContainer";
import { managerService } from "@/services/manager.service";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui-admin/card";
import { Badge } from "@/components/ui-admin/badge";
import { Button } from "@/components/ui-admin/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-admin/select";
import { Input } from "@/components/ui-admin/input";
import { Label } from "@/components/ui-admin/label";
import { Building2, MapPin, Users, Filter, Eye, X, Search, BarChart3, ChevronDown, Clock, MapPin as LocationIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";
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
import { buildingStatusMap } from "@/constants/building-status";
import type { BuildingStatus } from "@/types/types";

const ImmeublesPage = () => {
    const [view, setView] = useState<'table' | 'map'>('table');
    const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [immeubleToFocusId, setImmeubleToFocusId] = useState<string | null>(null);
    const [zoneToFocusId, setZoneToFocusId] = useState<string | null>(null);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const socket = useSocket();
    const { user } = useAuth();
    
    // Filtres avancés
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    const [prospectingModeFilter, setProspectingModeFilter] = useState<string>('all');
    const [coverageFilter, setCoverageFilter] = useState<string>('all');
    const [commercialFilter, setCommercialFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [immeubleToDelete, setImmeubleToDelete] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [itemsToDelete, setItemsToDelete] = useState<Immeuble[]>([]);

    // Récupérer l'ID du manager depuis le contexte d'authentification
    const managerId = user?.id || "";

    useEffect(() => {
        if (managerId) {
            fetchData();
        }
    }, [managerId]);

    // Socket listeners for real-time updates
    useEffect(() => {
        if (!socket) return;

        const handlePorteUpdated = () => {
            // Refresh data when a door is updated
            fetchData();
        };

        const handleImmeubleUpdated = () => {
            // Refresh data when an immeuble is updated
            fetchData();
        };

        socket.on('porteUpdated', handlePorteUpdated);
        socket.on('immeubleUpdated', handleImmeubleUpdated);

        return () => {
            socket.off('porteUpdated', handlePorteUpdated);
            socket.off('immeubleUpdated', handleImmeubleUpdated);
        };
    }, [socket]);

    // Fonction pour déterminer le statut de prospection (identique au côté commercial)
    const getProspectingStatus = (immeuble: any): { key: BuildingStatus; label: string; className: string; icon: any } => {
        if (!immeuble.portes || immeuble.portes.length === 0) {
            return { key: 'NON_CONFIGURE', ...buildingStatusMap.NON_CONFIGURE };
        }
        const visitedDoors = immeuble.portes.filter((porte: any) => porte.statut !== 'NON_VISITE').length;
        if (visitedDoors === immeuble.nbPortesTotal) {
            return { key: 'COMPLET', ...buildingStatusMap.COMPLET };
        }
        if (visitedDoors > 0) {
            return {
                key: 'EN_COURS',
                label: `En cours (${visitedDoors}/${immeuble.nbPortesTotal})`,
                className: buildingStatusMap.EN_COURS.className,
                icon: buildingStatusMap.EN_COURS.icon
            };
        }
        return { key: 'NON_COMMENCE', ...buildingStatusMap.NON_COMMENCE };
    };

    const fetchData = async () => {
        if (!managerId) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            const [immeublesFromApi, zonesFromApi] = await Promise.all([
                managerService.getManagerImmeubles(),
                managerService.getManagerZones()
            ]);
            
            const formattedImmeubles: Immeuble[] = immeublesFromApi.map(imm => {
                const prospecteurs = Array.isArray(imm.prospectors) ? imm.prospectors : [];
                const portes = Array.isArray(imm.portes) ? imm.portes : [];
                const historiques = Array.isArray(imm.historiques) ? imm.historiques : [];
                
                // Utiliser la même logique que le côté commercial
                const prospectingStatus = getProspectingStatus(imm);
                
                return {
                    id: imm.id,
                    adresse: imm.adresse,
                    ville: imm.ville,
                    codePostal: imm.codePostal,
                    status: prospectingStatus.label as Immeuble['status'],
                    nbPortes: portes.length,
                    nbPortesProspectees: portes.filter((porte: any) => porte.statut !== 'NON_VISITE').length,
                    prospectingMode: prospecteurs.length > 1 ? "Duo" : "Solo",
                    prospectors: prospecteurs.map((p: { id: string; prenom: string; nom: string; }) => ({
                        id: p.id,
                        nom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
                        avatarFallback: `${p.prenom?.[0] || ''}${p.nom?.[0] || ''}`.toUpperCase()
                    })),
                    dateVisite: historiques.length > 0 ? historiques[0].dateProspection : null,
                    zone: imm.zone?.nom || 'N/A',
                    zoneId: imm.zone?.id || '',
                    latlng: [imm.latitude || 0, imm.longitude || 0],
                    commercialId: imm.commercialId || '',
                    commercialName: imm.commercialName || 'N/A',
                };
            });
            
            const formattedZones: Zone[] = zonesFromApi.map((z: any) => ({
                id: z.id, name: z.nom, assignedTo: 'N/A',
                color: z.couleur || 'grey', latlng: [z.latitude || 0, z.longitude || 0],
                radius: z.rayonMetres, dateCreation: z.createdAt,
            }));

            setImmeubles(formattedImmeubles);
            setZones(formattedZones);

        } catch (error) {
            console.error("Erreur de chargement des données:", error);
            toast.error("Erreur lors du chargement des données");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAndFocusImmeuble = useCallback((immeuble: Immeuble) => {
        setImmeubleToFocusId(immeuble.id);
        setZoneToFocusId(null);
        setView('map');
    }, []);

    const handleSelectAndFocusZone = useCallback((zoneId: string) => {
        setZoneToFocusId(zoneId);
        setImmeubleToFocusId(null);
        setView('map');
    }, []);
    
    const handleViewChange = useCallback((newView: 'table' | 'map') => {
        if (newView === 'map') {
            // Switch manuel vers la carte → afficher tout (aucun focus spécifique)
            setImmeubleToFocusId(null);
            setZoneToFocusId(null);
        }
        setView(newView);
    }, []);

    const handleToggleDeleteMode = useCallback(() => {
        setIsDeleteMode(prev => !prev);
        setRowSelection({});
    }, []);

    // Filtrage des données
    const filteredImmeubles = useMemo(() => {
        return immeubles.filter(immeuble => {
            // Filtre par statut
            if (statusFilter !== 'all' && immeuble.status !== statusFilter) return false;
            
            // Filtre par zone
            if (zoneFilter !== 'all' && immeuble.zoneId !== zoneFilter) return false;
            
            // Filtre par mode de prospection
            if (prospectingModeFilter !== 'all' && immeuble.prospectingMode !== prospectingModeFilter) return false;
            
            // Filtre par commercial
            if (commercialFilter !== 'all' && immeuble.commercialId !== commercialFilter) return false;
            
            // Filtre par couverture
            if (coverageFilter !== 'all') {
                const percentage = immeuble.nbPortes > 0 ? (immeuble.nbPortesProspectees / immeuble.nbPortes) * 100 : 0;
                switch (coverageFilter) {
                    case 'low': if (percentage >= 25) return false; break;
                    case 'medium': if (percentage < 25 || percentage >= 75) return false; break;
                    case 'high': if (percentage < 75) return false; break;
                }
            }
            
            // Filtre par recherche textuelle
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    immeuble.adresse.toLowerCase().includes(searchLower) ||
                    immeuble.ville.toLowerCase().includes(searchLower) ||
                    immeuble.codePostal.toLowerCase().includes(searchLower) ||
                    immeuble.zone.toLowerCase().includes(searchLower) ||
                    immeuble.commercialName.toLowerCase().includes(searchLower)
                );
            }
            
            return true;
        });
    }, [immeubles, statusFilter, zoneFilter, prospectingModeFilter, commercialFilter, coverageFilter, searchTerm]);
    
    const handleDeleteImmeuble = useCallback((immeubleId: string) => {
        setImmeubleToDelete(immeubleId);
        setShowDeleteDialog(true);
    }, []);
    
    const columns = useMemo(() => createColumns(handleSelectAndFocusImmeuble, handleSelectAndFocusZone, handleDeleteImmeuble, isDeleteMode), [handleSelectAndFocusImmeuble, handleSelectAndFocusZone, handleDeleteImmeuble, isDeleteMode]);
    
    // Statistiques pour les cartes
    const stats = useMemo(() => {
        const total = immeubles.length;
        const nonConfigure = immeubles.filter(i => i.status === 'Non configuré').length;
        const aCommencer = immeubles.filter(i => i.status === 'À commencer').length;
        const enCours = immeubles.filter(i => i.status.startsWith('En cours')).length;
        const complet = immeubles.filter(i => i.status === 'Complet').length;
        const totalPortes = immeubles.reduce((acc, i) => acc + i.nbPortes, 0);
        const portesProspectees = immeubles.reduce((acc, i) => acc + i.nbPortesProspectees, 0);
        const avgCoverage = totalPortes > 0 ? (portesProspectees / totalPortes) * 100 : 0;
        
        return {
            total,
            nonConfigure,
            aCommencer,
            enCours,
            complet,
            avgCoverage,
            totalPortes,
            portesProspectees
        };
    }, [immeubles]);
    
    const uniqueZones = useMemo(() => {
        const zoneSet = new Set(immeubles.map(i => ({ id: i.zoneId, name: i.zone })));
        return Array.from(zoneSet).filter(z => z.id && z.name !== 'N/A');
    }, [immeubles]);

    const uniqueCommerciaux = useMemo(() => {
        const commercialSet = new Set(immeubles.map(i => ({ id: i.commercialId, name: i.commercialName })));
        return Array.from(commercialSet).filter(c => c.id && c.name !== 'N/A');
    }, [immeubles]);
    
    // Suggestions de recherche basées sur les données
    const searchSuggestions = useMemo(() => {
        if (!searchTerm.trim()) return [];
        
        const suggestions = new Set<{ type: string, value: string, icon: any, category: string }>();
        const searchLower = searchTerm.toLowerCase();
        
        // Suggestions d'adresses
        immeubles.forEach(imm => {
            if (imm.adresse.toLowerCase().includes(searchLower)) {
                suggestions.add({ 
                    type: 'adresse', 
                    value: imm.adresse, 
                    icon: Building2,
                    category: 'Adresses'
                });
            }
            
            // Suggestions de villes
            if (imm.ville.toLowerCase().includes(searchLower)) {
                suggestions.add({ 
                    type: 'ville', 
                    value: imm.ville, 
                    icon: LocationIcon,
                    category: 'Villes'
                });
            }
            
            // Suggestions de codes postaux
            if (imm.codePostal.toLowerCase().includes(searchLower)) {
                suggestions.add({ 
                    type: 'codePostal', 
                    value: imm.codePostal, 
                    icon: MapPin,
                    category: 'Codes Postaux'
                });
            }
            
            // Suggestions de zones
            if (imm.zone.toLowerCase().includes(searchLower)) {
                suggestions.add({ 
                    type: 'zone', 
                    value: imm.zone, 
                    icon: MapPin,
                    category: 'Zones'
                });
            }

            // Suggestions de commerciaux
            if (imm.commercialName.toLowerCase().includes(searchLower)) {
                suggestions.add({ 
                    type: 'commercial', 
                    value: imm.commercialName, 
                    icon: Users,
                    category: 'Commerciaux'
                });
            }
        });
        
        return Array.from(suggestions).slice(0, 8);
    }, [searchTerm, immeubles]);
    
    const handleSearchSelect = (suggestion: { type: string, value: string, icon: any, category: string }) => {
        setSearchTerm(suggestion.value);
        setShowSearchSuggestions(false);
        
        // Ajouter aux recherches récentes
        setRecentSearches(prev => {
            const updated = [suggestion.value, ...prev.filter(s => s !== suggestion.value)];
            return updated.slice(0, 5); // Garder seulement les 5 dernières
        });
    };
    
    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setShowSearchSuggestions(value.trim().length > 0);
    };
    
    const clearFilters = () => {
        setStatusFilter('all');
        setZoneFilter('all');
        setProspectingModeFilter('all');
        setCoverageFilter('all');
        setCommercialFilter('all');
        setSearchTerm('');
        setShowSearchSuggestions(false);
    };
    
    const confirmDeleteImmeuble = async () => {
        if (!immeubleToDelete || !managerId) return;
        
        try {
            // Trouver l'immeuble à supprimer pour récupérer le commercialId
            const immeubleToDeleteData = immeubles.find(imm => imm.id === immeubleToDelete);
            if (!immeubleToDeleteData) {
                toast.error("Immeuble non trouvé.");
                return;
            }
            
            await managerService.deleteManagerImmeuble(immeubleToDelete);
            fetchData(); // Refresh data after deletion
            toast.success("Immeuble supprimé avec succès.");
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            toast.error("Erreur lors de la suppression de l'immeuble.");
        } finally {
            setShowDeleteDialog(false);
            setImmeubleToDelete(null);
        }
    };

    const hasActiveFilters = statusFilter !== 'all' || zoneFilter !== 'all' || prospectingModeFilter !== 'all' || coverageFilter !== 'all' || commercialFilter !== 'all' || searchTerm;

    if (loading) {
        return <AdminPageSkeleton hasHeader hasTable hasCards hasFilters cardsCount={4} />;
    }

    const tableComponent = (
        <div className="space-y-6">
            {/* Cartes de statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Première ligne - États de prospection */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600 font-medium">Non configuré</p>
                                    <p className="text-2xl font-bold text-slate-900">{stats.nonConfigure}</p>
                                </div>
                                <Building2 className="h-8 w-8 text-slate-500" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-blue-600 font-medium">À commencer</p>
                                    <p className="text-2xl font-bold text-blue-900">{stats.aCommencer}</p>
                                </div>
                                <Eye className="h-8 w-8 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-amber-600 font-medium">En cours</p>
                                    <p className="text-2xl font-bold text-amber-900">{stats.enCours}</p>
                                </div>
                                <BarChart3 className="h-8 w-8 text-amber-500" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-emerald-600 font-medium">Complets</p>
                                    <p className="text-2xl font-bold text-emerald-900">{stats.complet}</p>
                                </div>
                                <Users className="h-8 w-8 text-emerald-500" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
            
            {/* Deuxième ligne - Métriques globales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-indigo-600 font-medium">Total immeubles</p>
                                    <p className="text-2xl font-bold text-indigo-900">{stats.total}</p>
                                </div>
                                <Building2 className="h-8 w-8 text-indigo-500" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-violet-600 font-medium">Couverture moyenne</p>
                                    <p className="text-2xl font-bold text-violet-900">{stats.avgCoverage.toFixed(1)}%</p>
                                </div>
                                <BarChart3 className="h-8 w-8 text-violet-500" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
            
            {/* Barre de recherche moderne et filtres */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header avec titre et boutons */}
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Gestion des Immeubles</h2>
                                <p className="text-sm text-slate-600">{filteredImmeubles.length} résultat{filteredImmeubles.length > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "transition-all duration-200",
                                    showFilters ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm" : "hover:bg-slate-50"
                                )}
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                Filtres
                                <ChevronDown className={cn(
                                    "h-3 w-3 ml-2 transition-transform duration-200",
                                    showFilters && "rotate-180"
                                )} />
                                {hasActiveFilters && <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 text-xs">!</Badge>}
                            </Button>
                            {hasActiveFilters && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Effacer
                                    </Button>
                                </motion.div>
                            )}

                            {/* Boutons d'action alignés à droite du header */}
                            {!isDeleteMode ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleToggleDeleteMode}
                                >
                                    Supprimer
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                            const selectedKeys = Object.keys(rowSelection).filter(k => rowSelection[k]);
                                            const selected = selectedKeys
                                                .map(k => Number(k))
                                                .map(idx => filteredImmeubles[idx])
                                                .filter(Boolean);
                                            if (selected.length > 0) {
                                                setItemsToDelete(selected);
                                            }
                                        }}
                                        disabled={Object.keys(rowSelection).filter(k => rowSelection[k]).length === 0}
                                        className="bg-red-600 text-white hover:bg-red-700"
                                    >
                                        Supprimer ({Object.keys(rowSelection).filter(k => rowSelection[k]).length})
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleToggleDeleteMode}>Annuler</Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Barre de recherche moderne */}
                <div className="px-6 py-4 bg-white">
                    <div className="relative max-w-2xl">
                        <div className={cn(
                            "relative flex items-center rounded-xl border-2 transition-all duration-300",
                            searchFocused 
                                ? "border-blue-300 shadow-lg shadow-blue-100/50 bg-blue-50/50" 
                                : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                        )}>
                            <div className="flex items-center pl-4 pr-2">
                                <Search className={cn(
                                    "h-5 w-5 transition-colors duration-200",
                                    searchFocused ? "text-blue-500" : "text-slate-400"
                                )} />
                            </div>
                            <Input
                                placeholder="Rechercher par adresse, ville, code postal, zone ou commercial..."
                                value={searchTerm}
                                onChange={handleSearchInputChange}
                                onFocus={() => {
                                    setSearchFocused(true);
                                    if (searchTerm.trim()) setShowSearchSuggestions(true);
                                }}
                                onBlur={() => {
                                    setSearchFocused(false);
                                    // Délai pour permettre le clic sur les suggestions
                                    setTimeout(() => setShowSearchSuggestions(false), 200);
                                }}
                                className="border-0 bg-transparent text-base placeholder:text-slate-500 focus:ring-0 focus-visible:ring-0 px-2"
                            />
                            {searchTerm && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    onClick={() => {
                                        setSearchTerm('');
                                        setShowSearchSuggestions(false);
                                    }}
                                    className="p-2 mr-2 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    <X className="h-4 w-4 text-slate-400" />
                                </motion.button>
                            )}
                        </div>
                        
                        {/* Suggestions dropdown */}
                        <AnimatePresence>
                            {showSearchSuggestions && (searchSuggestions.length > 0 || recentSearches.length > 0) && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                                >
                                    {/* Recherches récentes */}
                                    {!searchTerm && recentSearches.length > 0 && (
                                        <div className="p-3 border-b border-slate-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Récentes</span>
                                            </div>
                                            {recentSearches.map((search, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleSearchSelect({ type: 'recent', value: search, icon: Clock, category: 'Récentes' })}
                                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-700"
                                                >
                                                    {search}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Suggestions */}
                                    {searchSuggestions.length > 0 && (
                                        <div className="max-h-64 overflow-y-auto">
                                            {Object.entries(
                                                searchSuggestions.reduce((acc, suggestion) => {
                                                    if (!acc[suggestion.category]) acc[suggestion.category] = [];
                                                    acc[suggestion.category].push(suggestion);
                                                    return acc;
                                                }, {} as Record<string, typeof searchSuggestions>)
                                            ).map(([category, suggestions]) => (
                                                <div key={category} className="p-3 border-b border-slate-100 last:border-b-0">
                                                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                                        {category}
                                                    </div>
                                                    {suggestions.map((suggestion, index) => {
                                                        const Icon = suggestion.icon;
                                                        return (
                                                            <motion.button
                                                                key={`${category}-${index}`}
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: index * 0.05 }}
                                                                onClick={() => handleSearchSelect(suggestion)}
                                                                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all duration-200 group"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-1.5 rounded-md bg-slate-100 group-hover:bg-blue-100 transition-colors">
                                                                        <Icon className="h-3.5 w-3.5 text-slate-600 group-hover:text-blue-600" />
                                                                    </div>
                                                                    <span className="text-sm text-slate-700 group-hover:text-blue-700 font-medium">
                                                                        {suggestion.value}
                                                                    </span>
                                                                </div>
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Aucun résultat */}
                                    {searchSuggestions.length === 0 && recentSearches.length === 0 && (
                                        <div className="p-4 text-center text-slate-500 text-sm">
                                            <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                            Aucune suggestion trouvée
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <CardContent className="pt-0 border-t">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div>
                                        <Label className="text-sm font-medium text-slate-600">Statut</Label>
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Tous les statuts" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tous les statuts</SelectItem>
                                                <SelectItem value="Non configuré">Non configuré</SelectItem>
                                                <SelectItem value="À commencer">À commencer</SelectItem>
                                                <SelectItem value="En cours">En cours</SelectItem>
                                                <SelectItem value="Complet">Complet</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <Label className="text-sm font-medium text-slate-600">Zone</Label>
                                        <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Toutes les zones" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Toutes les zones</SelectItem>
                                                {uniqueZones.map(zone => (
                                                    <SelectItem key={zone.id} value={zone.id}>
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="h-3 w-3" />
                                                            {zone.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <Label className="text-sm font-medium text-slate-600">Commercial</Label>
                                        <Select value={commercialFilter} onValueChange={setCommercialFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Tous les commerciaux" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tous les commerciaux</SelectItem>
                                                {uniqueCommerciaux.map(commercial => (
                                                    <SelectItem key={commercial.id} value={commercial.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-3 w-3" />
                                                            {commercial.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <Label className="text-sm font-medium text-slate-600">Mode</Label>
                                        <Select value={prospectingModeFilter} onValueChange={setProspectingModeFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Tous les modes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tous les modes</SelectItem>
                                                <SelectItem value="Solo">Solo</SelectItem>
                                                <SelectItem value="Duo">Duo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <Label className="text-sm font-medium text-slate-600">Couverture</Label>
                                        <Select value={coverageFilter} onValueChange={setCoverageFilter}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Toutes couvertures" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Toutes couvertures</SelectItem>
                                                <SelectItem value="low">Faible (&lt; 25%)</SelectItem>
                                                <SelectItem value="medium">Moyenne (25-75%)</SelectItem>
                                                <SelectItem value="high">Élevée (&gt; 75%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            {/* Tableau moderne */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <DataTable
                    noCardWrapper
                    columns={columns}
                    data={filteredImmeubles}
                    title=""
                    filterColumnId={null}
                    filterPlaceholder=""
                    addEntityButtonText={undefined}
                    onAddEntity={undefined}
                    isDeleteMode={isDeleteMode}
                    onToggleDeleteMode={undefined}
                    onConfirmDelete={undefined}
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowClick={isDeleteMode ? undefined : handleSelectAndFocusImmeuble}
                    customHeaderContent={isDeleteMode ? <div className="hidden" /> : undefined}
                />
            </div>
        </div>
    );
    
    const mapComponent = (
        <ImmeublesMap 
            zones={zones} 
            immeubles={immeubles} 
            immeubleToFocusId={immeubleToFocusId}
            zoneToFocusId={zoneToFocusId}
        />
    );

    return (
        <>
            <ViewToggleContainer
                title="Gestion des Immeubles"
                description="Basculez entre la vue tableau et la vue carte. Cliquez sur une adresse ou une zone pour la localiser."
                view={view}
                onViewChange={handleViewChange}
                tableComponent={tableComponent}
                mapComponent={mapComponent}
            />
            
            {/* Dialog de confirmation suppression multiple */}
            <AlertDialog open={itemsToDelete.length > 0} onOpenChange={(open) => { if (!open) setItemsToDelete([]) }}>
                <AlertDialogContent className="bg-white rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer les {itemsToDelete.length} immeuble(s) sélectionné(s) ?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-3 mb-2">
                        <ul className="list-disc ml-5 text-sm text-slate-700">
                            {itemsToDelete.map(i => (<li key={i.id}>{i.adresse} ({i.codePostal} {i.ville})</li>))}
                        </ul>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setItemsToDelete([])}>
                            Annuler
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                try {
                                    await Promise.all(itemsToDelete.map(i => 
                                        managerService.deleteManagerImmeuble(i.id)
                                    ));
                                    toast.success("Immeubles supprimés.");
                                    setItemsToDelete([]);
                                    setIsDeleteMode(false);
                                    setRowSelection({});
                                    fetchData();
                                } catch (e) {
                                    toast.error("Erreur lors de la suppression.");
                                }
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Supprimer définitivement
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog de confirmation de suppression */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="bg-white rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer cet immeuble ? Cette action est irréversible et supprimera également toutes les données associées (portes, historique de prospection, etc.).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
                            Annuler
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={confirmDeleteImmeuble}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Supprimer définitivement
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default ImmeublesPage;
