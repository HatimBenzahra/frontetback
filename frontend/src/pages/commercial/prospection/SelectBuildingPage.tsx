import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui-admin/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { ArrowRight, MapPin, Search, Clock, DoorOpen, CheckCircle, Info, Loader2, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { immeubleService } from '@/services/immeuble.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui-admin/skeleton';
import { Input } from '@/components/ui-admin/input';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

import type { ImmeubleFromApi as ImmeubleFromApiBase } from '@/services/immeuble.service';
type ImmeubleFromApi = ImmeubleFromApiBase & { zone: { id: string; nom: string } | null };
type AssignedZone = { id: string; nom: string };

const PageSkeleton = () => (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="space-y-8 animate-pulse max-w-screen-2xl mx-auto">
            <Skeleton className="h-12 w-1/2 bg-slate-200 rounded-lg" />
            <Skeleton className="h-16 w-full rounded-xl bg-slate-200" />
            <div className="flex gap-4">
                <Skeleton className="h-10 w-32 rounded-full bg-slate-200" />
                <Skeleton className="h-10 w-32 rounded-full bg-slate-200" />
                <Skeleton className="h-10 w-32 rounded-full bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-60 w-full rounded-2xl bg-slate-200" />)}
            </div>
        </div>
    </div>
);

const buildingStatusMap: { [key: string]: { label: string; className: string; icon: React.ElementType } } = {
    NON_CONFIGURE: { label: "À configurer", className: "bg-slate-100 text-slate-600", icon: Info },
    NON_COMMENCE: { label: "À commencer", className: "bg-yellow-100 text-yellow-700", icon: CheckCircle },
    EN_COURS: { label: "En cours", className: "bg-blue-100 text-blue-700", icon: Loader2 },
    COMPLET: { label: "Terminé", className: "bg-zinc-100 text-zinc-600 line-through", icon: CheckCircle },
};

const SelectBuildingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [allImmeubles, setAllImmeubles] = useState<ImmeubleFromApi[]>([]);
    const [assignedZone, setAssignedZone] = useState<AssignedZone | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [showAll, setShowAll] = useState(false);

    const fetchInitialData = useCallback(async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            const [immeublesData, zonesData] = await Promise.all([
                immeubleService.getImmeublesForCommercial(user.id),
                assignmentGoalsService.getAssignedZonesForCommercial(user.id)
            ]);
            const sortedImmeubles = immeublesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAllImmeubles(sortedImmeubles as ImmeubleFromApi[]);
            if (zonesData && zonesData.length > 0) setAssignedZone(zonesData[0]);
        } catch (err) {
            toast.error('Impossible de charger les données.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

    const getProspectingStatus = (immeuble: ImmeubleFromApi) => {
        if (!immeuble.portes || immeuble.portes.length === 0) return { key: 'NON_CONFIGURE', ...buildingStatusMap.NON_CONFIGURE };
        const visitedDoors = immeuble.portes.filter(p => p.statut !== 'NON_VISITE').length;
        if (visitedDoors === immeuble.nbPortesTotal) return { key: 'COMPLET', ...buildingStatusMap.COMPLET };
        if (visitedDoors > 0) return { key: 'EN_COURS', label: `En cours (${visitedDoors}/${immeuble.nbPortesTotal})`, className: buildingStatusMap.EN_COURS.className, icon: buildingStatusMap.EN_COURS.icon };
        return { key: 'NON_COMMENCE', ...buildingStatusMap.NON_COMMENCE };
    };

    const filteredImmeubles = useMemo(() => {
        let filtered = allImmeubles.filter(im => 
            im.adresse.toLowerCase().includes(searchTerm.toLowerCase()) ||
            im.ville.toLowerCase().includes(searchTerm.toLowerCase()) ||
            im.codePostal.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (activeFilter === 'incomplete') {
            filtered = filtered.filter(im => getProspectingStatus(im).key === 'EN_COURS');
        } else if (activeFilter === 'my_zone' && assignedZone) {
            filtered = filtered.filter(im => im.zone?.id === assignedZone.id);
        }
        return filtered;
    }, [allImmeubles, searchTerm, activeFilter, assignedZone]);

    const displayedImmeubles = useMemo(() => {
        return showAll ? filteredImmeubles : filteredImmeubles.slice(0, 6);
    }, [filteredImmeubles, showAll]);

    const handleSelectBuilding = (buildingId: string) => {
        const selectedBuilding = allImmeubles.find(b => b.id === buildingId);
        if (!selectedBuilding) return;

        const status = getProspectingStatus(selectedBuilding);
        if (status.key === 'COMPLET') {
            toast.info("Cet immeuble a déjà été entièrement prospecté.");
            return;
        }

        if (status.key === 'NON_CONFIGURE') {
            navigate(`setup/${buildingId}`);
        } else {
            navigate(`doors/${buildingId}`);
        }
    };

    if (loading) return <PageSkeleton />;

    const FilterButton = ({ filterKey, label, icon: Icon }: { filterKey: string, label: string, icon?: React.ElementType }) => (
        <button
            key={filterKey}
            onClick={() => setActiveFilter(filterKey)}
            className={cn(
                "px-3 py-1.5 text-sm rounded-md font-semibold transition-colors duration-200 flex items-center gap-2 whitespace-nowrap",
                activeFilter === filterKey
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
            )}
        >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
        </button>
    );

    return (
        <div className="bg-slate-50 min-h-screen">
            <motion.div 
                className="space-y-8 max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                

                <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <CardContent className="p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <Input
                                placeholder="Rechercher une adresse, ville, ou code postal..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full rounded-lg bg-slate-100 border-transparent focus:ring-2 focus:ring-blue-500 transition"
                            />
                        </div>
                        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                            <FilterButton filterKey="all" label="Tous les immeubles" />
                            <FilterButton filterKey="incomplete" label="En cours" icon={Clock} />
                            {assignedZone && <FilterButton filterKey="my_zone" label={`Ma Zone: ${assignedZone.nom}`} icon={MapPin} />}
                        </div>
                    </CardContent>
                </Card>

                {displayedImmeubles.length === 0 ? (
                    <div className="text-center py-20 col-span-full bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <Search className="mx-auto h-16 w-16 text-slate-400 mb-4" />
                        <p className="text-xl font-semibold text-slate-800">Aucun immeuble trouvé</p>
                        <p className="text-slate-500 mt-2">Essayez de modifier vos filtres ou d'ajouter un nouvel immeuble.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayedImmeubles.map((immeuble, index) => {
                                const status = getProspectingStatus(immeuble);
                                const StatusIcon = status.icon;
                                const isComplete = status.key === 'COMPLET';

                                return (
                                    <motion.div
                                        key={immeuble.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: index * 0.05 }}
                                        className="w-full h-full"
                                    >
                                        <Card 
                                            className={cn(
                                                "flex flex-col h-full rounded-2xl bg-white text-card-foreground shadow-sm border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300",
                                                isComplete ? 'opacity-70 bg-slate-50' : 'cursor-pointer'
                                            )}
                                            onClick={() => handleSelectBuilding(immeuble.id)}
                                        >
                                            <CardHeader className="pb-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5", status.className)}>
                                                        <StatusIcon className={cn("h-3.5 w-3.5", status.key === 'EN_COURS' && 'animate-spin')} />
                                                        {status.label}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                        <DoorOpen className="h-5 w-5 text-slate-500" />
                                                        {immeuble.nbPortesTotal}
                                                    </div>
                                                </div>
                                                <CardTitle className="text-md font-bold break-words text-slate-800">{immeuble.adresse}</CardTitle>
                                                <CardDescription className="text-sm text-slate-500 flex items-center gap-2 pt-1">
                                                    <MapPin className="h-4 w-4" />
                                                    {immeuble.ville}, {immeuble.codePostal}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-grow flex flex-col justify-end">
                                                <Button 
                                                    className={cn(
                                                        "w-full mt-4 font-semibold py-2.5 rounded-lg text-white transition-all duration-200 flex items-center justify-center gap-2",
                                                        isComplete ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'
                                                    )}
                                                    disabled={isComplete}
                                                >
                                                    {status.key === 'NON_CONFIGURE' ? 'Configurer' : (status.key === 'COMPLET' ? 'Terminé' : 'Continuer')}
                                                    {!isComplete && <ArrowRight className="h-5 w-5" />}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                        {filteredImmeubles.length > 6 && !showAll && (
                            <div className="text-center mt-8">
                                <Button 
                                    variant="outline"
                                    onClick={() => setShowAll(true)}
                                    className="bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2.5 px-6 rounded-full shadow-sm border-slate-200 transition-all duration-300"
                                >
                                    <ChevronDown className="mr-2 h-5 w-5" />
                                    Voir plus d'immeubles ({filteredImmeubles.length - 6} restants)
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default SelectBuildingPage;
