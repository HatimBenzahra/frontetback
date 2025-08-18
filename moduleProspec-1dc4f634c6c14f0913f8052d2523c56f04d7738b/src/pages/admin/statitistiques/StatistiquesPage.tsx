// src/pages/admin/statistiques/StatistiquesPage.tsx
import { useState, useMemo, useEffect } from 'react';
import { statisticsService } from '@/services/statistics.service';
import type { PeriodType, StatEntityType } from '@/services/statistics.service';
import { motion } from 'framer-motion';

// --- Imports des Composants ---
import StatCard from '@/components/ui-admin/StatCard';
import { GenericBarChart } from '@/components/charts/GenericBarChart';
import { GenericPieChart } from '@/components/charts/GenericPieChart';
import { LeaderboardTable } from './LeaderboardTable';
import { Button } from '@/components/ui-admin/button';
import { Badge } from '@/components/ui-admin/badge';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

// --- Imports des Icônes ---
import { 
    BarChart3, Briefcase, FileSignature, Target
} from 'lucide-react';
import { managerService } from '@/services/manager.service';
import { equipeService } from '@/services/equipe.service';
import { commercialService } from '@/services/commercial.service';

const StatistiquesPage = () => {
    const [timeFilter, setTimeFilter] = useState<PeriodType>('MONTHLY');
    const [entityType, setEntityType] = useState<StatEntityType | 'ALL'>('ALL');
    const [entityId, setEntityId] = useState<string | undefined>(undefined);
    
    const [statsData, setStatsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [entities, setEntities] = useState<{ id: string, nom: string }[]>([]);
    const [loadingEntities, setLoadingEntities] = useState(false);

    useEffect(() => {
        const fetchEntities = async () => {
            if (entityType === 'ALL') {
                setEntities([]);
                setEntityId(undefined);
                return;
            }
            setLoadingEntities(true);
            try {
                let data: any[] = [];
                if (entityType === 'MANAGER') {
                    data = await managerService.getManagers();
                } else if (entityType === 'EQUIPE') {
                    data = await equipeService.getEquipes();
                } else if (entityType === 'COMMERCIAL') {
                    data = await commercialService.getCommerciaux();
                }
                setEntities(data.map((e: any) => ({ id: e.id, nom: e.nom || `${e.prenom} ${e.nom}` })));
            } catch (err) {
                console.error("Failed to fetch entities:", err);
                setEntities([]);
            } finally {
                setLoadingEntities(false);
            }
        };

        fetchEntities();
    }, [entityType]);

    useEffect(() => {
        const fetchStatistics = async () => {
            setLoading(true);
            setError(null);
            try {
                const query = {
                    period: timeFilter,
                    ...(entityType !== 'ALL' && { entityType }),
                    ...(entityType !== 'ALL' && entityId && { entityId }),
                };
                const data = await statisticsService.getStatistics(query);
                setStatsData(data);
            } catch (err) {
                setError("Impossible de charger les statistiques.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStatistics();
    }, [timeFilter, entityType, entityId]);

    // removed old handlers (dropdown-based) no longer used after pill UI

    const currentData = useMemo(() => {
        if (!statsData) return null;
        
        const kpis = {
            contratsSignes: statsData.totalContrats ?? 0,
            rdvPris: statsData.totalRdv ?? 0,
            tauxConclusionGlobal: statsData.tauxConclusion ?? 0,
            portesVisitees: statsData.totalPortesVisitees ?? 0,
        };

        const mapToPerformer = (item: any, index: number) => ({
            rank: index + 1,
            name: item.name,
            avatar: item.name.substring(0, 2).toUpperCase(),
            value: item.value,
            change: 0, // La propriété 'change' n'est pas fournie par l'API
        });

        const leaderboards = {
            managers: statsData.leaderboards?.managers.map(mapToPerformer) ?? [],
            equipes: statsData.leaderboards?.equipes.map(mapToPerformer) ?? [],
            commerciaux: statsData.leaderboards?.commerciaux.map(mapToPerformer) ?? [],
        };

        const charts = {
            contratsParEquipe: statsData.contratsParEquipe ?? [],
            repartitionParManager: statsData.repartitionParManager ?? [],
        };

        return { kpis, leaderboards, charts };
    }, [statsData]);

    if (loading) return <AdminPageSkeleton hasHeader hasCards hasCharts hasFilters cardsCount={4} chartsCount={2} />;
    if (error) return <div className="text-red-500">{error}</div>;
    if (!currentData) return <div>Aucune donnée disponible.</div>;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8 p-8 bg-white min-h-screen font-sans"
        >
            <div className="flex flex-wrap gap-6 justify-between items-center pb-6 border-b border-gray-200 mb-5 mt-0.25">
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Tableau de Bord des Statistiques</h1>
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 w-full md:w-auto">
                    <div className="flex flex-wrap gap-2" aria-label="Type d'entité">
                        {[
                            { value: 'ALL', label: 'Toutes' },
                            { value: 'MANAGER', label: 'Managers' },
                            { value: 'EQUIPE', label: 'Équipes' },
                            { value: 'COMMERCIAL', label: 'Commerciaux' },
                        ].map(opt => (
                            <Button
                                key={opt.value}
                                variant="ghost"
                                onClick={() => {
                                    const selected = opt.value as StatEntityType | 'ALL';
                                    if (entityType === selected) {
                                        setEntityType('ALL');
                                        setEntityId(undefined);
                                    } else {
                                        setEntityType(selected);
                                        setEntityId(undefined);
                                    }
                                }}
                                className={cn(
                                    'rounded-full px-4 py-2 border',
                                    entityType === (opt.value as any)
                                        ? 'bg-[hsl(var(--winvest-blue-moyen))] text-white border-transparent'
                                        : 'text-gray-700 border-gray-200 hover:bg-gray-100'
                                )}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                    {entityType !== 'ALL' && (
                        <div className="flex flex-wrap gap-2" aria-label="Sélection d'entité">
                            <Button
                                variant="ghost"
                                onClick={() => setEntityId(undefined)}
                                disabled={loadingEntities}
                                className={cn(
                                    'rounded-full px-4 py-2 border',
                                    !entityId ? 'bg-gray-900 text-white border-transparent' : 'text-gray-700 border-gray-200 hover:bg-gray-100'
                                )}
                            >
                                Tous
                            </Button>
                            {entities.map((e) => (
                                <Button
                                    key={e.id}
                                    variant="ghost"
                                    onClick={() => setEntityId(entityId === e.id ? undefined : e.id)}
                                    className={cn(
                                        'rounded-full px-4 py-2 border',
                                        entityId === e.id
                                            ? 'bg-[hsl(var(--winvest-blue-moyen))] text-white border-transparent'
                                            : 'text-gray-700 border-gray-200 hover:bg-gray-100'
                                    )}
                                >
                                    {e.nom}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 p-1 bg-white rounded-xl shadow-sm border border-gray-200">
                    <Button 
                        variant='ghost' 
                        onClick={() => setTimeFilter('WEEKLY')} 
                        className={cn(
                            "px-5 py-2 rounded-lg text-base font-medium transition-all duration-300", 
                            timeFilter === 'WEEKLY' 
                                ? 'bg-[hsl(var(--winvest-blue-moyen))] text-white shadow-md hover:bg-[hsl(var(--winvest-blue-moyen))] hover:text-white' 
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                    >Cette semaine</Button>
                    <Button 
                        variant='ghost' 
                        onClick={() => setTimeFilter('MONTHLY')} 
                        className={cn(
                            "px-5 py-2 rounded-lg text-base font-medium transition-all duration-300", 
                            timeFilter === 'MONTHLY' 
                                ? 'bg-[hsl(var(--winvest-blue-moyen))] text-white shadow-md hover:bg-[hsl(var(--winvest-blue-moyen))] hover:text-white' 
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                    >Ce mois</Button>
                    <Button 
                        variant='ghost' 
                        onClick={() => setTimeFilter('YEARLY')} 
                        className={cn(
                            "px-5 py-2 rounded-lg text-base font-medium transition-all duration-300", 
                            timeFilter === 'YEARLY' 
                                ? 'bg-[hsl(var(--winvest-blue-moyen))] text-white shadow-md hover:bg-[hsl(var(--winvest-blue-moyen))] hover:text-white' 
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                    >Cette année</Button>
                </div>
            </div>

            {/* Barre des filtres actifs */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-600">Filtres actifs:</span>
                    {/* Période */}
                    <Badge variant="secondary">
                        {timeFilter === 'WEEKLY' ? 'Cette semaine' : timeFilter === 'MONTHLY' ? 'Ce mois' : 'Cette année'}
                    </Badge>
                    {/* Type d'entité si non ALL */}
                    {entityType !== 'ALL' && (
                        <Badge variant="outline">
                            {entityType === 'MANAGER' ? 'Manager' : entityType === 'EQUIPE' ? 'Équipe' : 'Commercial'}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setEntityType('ALL');
                                    setEntityId(undefined);
                                }}
                                className="ml-1 h-5 px-1 text-xs rounded"
                            >
                                ×
                            </Button>
                        </Badge>
                    )}
                    {/* Entité spécifique */}
                    {entityType !== 'ALL' && entityId && (
                        <Badge variant="outline">
                            {entities.find(e => e.id === entityId)?.nom || 'Sélection'}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEntityId(undefined)}
                                className="ml-1 h-5 px-1 text-xs rounded"
                            >
                                ×
                            </Button>
                        </Badge>
                    )}
                </div>
                <div>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setTimeFilter('MONTHLY');
                            setEntityType('ALL');
                            setEntityId(undefined);
                        }}
                        className="rounded-full border border-gray-200 hover:bg-gray-100"
                    >
                        Réinitialiser les filtres
                    </Button>
                </div>
            </div>

            <section className="mt-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Indicateurs Clés de Performance (KPIs)</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Contrats Signés" value={currentData.kpis.contratsSignes} Icon={FileSignature} color="text-emerald-600" />
                    <StatCard title="RDV Pris" value={currentData.kpis.rdvPris} Icon={Briefcase} color="text-sky-600" />
                    <StatCard title="Portes Visitées" value={currentData.kpis.portesVisitees} Icon={BarChart3} color="text-orange-600" />
                    <StatCard title="Taux de Conclusion Global" value={currentData.kpis.tauxConclusionGlobal} Icon={Target} suffix="%" color="text-violet-600" />
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 mt-8">
                {/* Main Content Column (Charts) */}
                <div className="space-y-6">
                    <Card className="shadow-lg border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-4 px-6">
                            <CardTitle className="text-lg font-semibold text-gray-800">Contrats par Équipe</CardTitle>
                            <CardDescription className="text-sm text-gray-600">Répartition des contrats signés par équipe.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <GenericBarChart
                                title="Contrats par Équipe"
                                data={currentData.charts.contratsParEquipe}
                                xAxisDataKey="name"
                                bars={[
                                    { dataKey: 'value', fill: 'hsl(var(--winvest-blue-moyen))', name: 'Contrats' }
                                ]}
                            />
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-4 px-6">
                            <CardTitle className="text-lg font-semibold text-gray-800">Répartition des Contrats par Manager</CardTitle>
                            <CardDescription className="text-sm text-gray-600">Pourcentage des contrats attribués à chaque manager.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <GenericPieChart
                                title="Répartition des Contrats par Manager"
                                data={currentData.charts.repartitionParManager}
                                dataKey="value"
                                nameKey="name"
                                colors={['hsl(var(--winvest-blue-moyen))', 'hsl(var(--winvest-blue-clair))', 'hsl(var(--winvest-blue-nuit))', 'hsl(var(--winvest-blue-profond))']}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            <section className="mt-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Classements</h2>
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
                    <LeaderboardTable title="Top Managers" description="Basé sur le nombre de contrats signés par leurs équipes." data={currentData.leaderboards.managers} unit="Contrats" />
                    <LeaderboardTable title="Top Équipes" description="Basé sur le nombre total de contrats signés." data={currentData.leaderboards.equipes} unit="Contrats" />
                    <LeaderboardTable title="Top Commerciaux" description="Basé sur leurs contrats signés individuels." data={currentData.leaderboards.commerciaux} unit="Contrats" />
                </div>
            </section>
        </motion.div>
    );
};

export default StatistiquesPage;