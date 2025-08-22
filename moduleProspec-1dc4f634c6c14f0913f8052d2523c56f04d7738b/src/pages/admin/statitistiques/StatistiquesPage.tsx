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
    BarChart3, Briefcase, FileSignature, Target, TrendingUp, Filter, X, RefreshCw
} from 'lucide-react';
import { managerService } from '@/services/manager.service';
import { equipeService } from '@/services/equipe.service';
import { commercialService } from '@/services/commercial.service';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';

const StatistiquesPage = () => {
    const { settings } = useDashboardSettings();
    const [timeFilter, setTimeFilter] = useState<PeriodType>(settings.statisticsDefaultPeriod || 'MONTHLY');
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

    // Synchroniser la période par défaut avec les paramètres si l'utilisateur n'a pas encore interagi
    useEffect(() => {
        setTimeFilter(settings.statisticsDefaultPeriod || 'MONTHLY');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.statisticsDefaultPeriod]);

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
            className="space-y-8 p-6 bg-gradient-to-br from-white via-blue-50/60 to-blue-100/30 min-h-screen font-sans"
        >
            {/* Header moderne avec gradient */}
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-2xl p-8 text-white shadow-xl">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10">
                    <div className="flex flex-wrap gap-6 justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <BarChart3 className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord des Statistiques</h1>
                                <p className="text-blue-100 mt-1">Analysez les performances de votre équipe</p>
                            </div>
                        </div>
                        <button 
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 h-8 px-3 text-xs border-2 border-white/30 bg-transparent text-white hover:bg-white/20 hover:border-white/50 backdrop-blur-sm"
                            style={{
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                color: 'white',
                            }}
                            onClick={() => {
                                setLoading(true);
                                setError(null);
                                // Recharger les données
                                const fetchStatistics = async () => {
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
                            }}
                            disabled={loading}
                        >
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                            {loading ? "Actualisation..." : "Actualiser"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Filtres modernes avec design glassmorphism */}
            <div className="backdrop-blur bg-white/90 rounded-2xl p-6 shadow-lg border border-blue-100">
                <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Filtres</h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setTimeFilter('MONTHLY');
                            setEntityType('ALL');
                            setEntityId(undefined);
                        }}
                        className="text-blue-600 hover:bg-blue-50 rounded-full"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Réinitialiser
                    </Button>
                </div>

                {/* Type d'entité */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {[
                        { value: 'ALL', label: 'Toutes', icon: '📊' },
                        { value: 'MANAGER', label: 'Managers', icon: '👨‍💼' },
                        { value: 'EQUIPE', label: 'Équipes', icon: '👥' },
                        { value: 'COMMERCIAL', label: 'Commerciaux', icon: '👤' },
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
                                'rounded-full px-4 py-2 border transition-all duration-200',
                                entityType === (opt.value as any)
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                    : 'text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-200'
                            )}
                        >
                            <span className="mr-2">{opt.icon}</span>
                            {opt.label}
                        </Button>
                    ))}
                </div>

                {/* Sélection d'entité spécifique */}
                {entityType !== 'ALL' && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Button
                            variant="ghost"
                            onClick={() => setEntityId(undefined)}
                            disabled={loadingEntities}
                            className={cn(
                                'rounded-full px-3 py-1.5 border text-sm transition-all duration-200',
                                !entityId ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'text-gray-700 border-gray-200 hover:bg-gray-50'
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
                                    'rounded-full px-3 py-1.5 border text-sm transition-all duration-200',
                                    entityId === e.id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                        : 'text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-200'
                                )}
                            >
                                {e.nom}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Période */}
                <div className="flex flex-wrap items-center gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200">
                    {[
                        { value: 'WEEKLY', label: 'Cette semaine' },
                        { value: 'MONTHLY', label: 'Ce mois' },
                        { value: 'YEARLY', label: 'Cette année' },
                    ].map(period => (
                        <Button 
                            key={period.value}
                            variant='ghost' 
                            onClick={() => setTimeFilter(period.value as PeriodType)} 
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border", 
                                timeFilter === period.value 
                                    ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 border-blue-600' 
                                    : 'text-gray-700 hover:bg-white hover:text-gray-900 border-gray-300 bg-white'
                            )}
                        >
                            {period.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Filtres actifs avec design moderne */}
            {(entityType !== 'ALL' || entityId) && (
                <div className="flex flex-wrap items-center justify-between gap-4 backdrop-blur bg-blue-50/80 border border-blue-200 rounded-xl px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-blue-800">Filtres actifs:</span>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                            {timeFilter === 'WEEKLY' ? 'Cette semaine' : timeFilter === 'MONTHLY' ? 'Ce mois' : 'Cette année'}
                        </Badge>
                        {entityType !== 'ALL' && (
                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                                {entityType === 'MANAGER' ? 'Manager' : entityType === 'EQUIPE' ? 'Équipe' : 'Commercial'}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEntityType('ALL');
                                        setEntityId(undefined);
                                    }}
                                    className="ml-1 h-5 px-1 text-xs rounded hover:bg-blue-100"
                                >
                                    ×
                                </Button>
                            </Badge>
                        )}
                        {entityType !== 'ALL' && entityId && (
                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                                {entities.find(e => e.id === entityId)?.nom || 'Sélection'}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEntityId(undefined)}
                                    className="ml-1 h-5 px-1 text-xs rounded hover:bg-blue-100"
                                >
                                    ×
                                </Button>
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            {/* KPIs avec design moderne */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-1 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
                    <h2 className="text-2xl font-bold text-gray-900">Indicateurs Clés de Performance</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <StatCard title="Contrats Signés" value={currentData.kpis.contratsSignes} Icon={FileSignature} color="text-emerald-600" />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <StatCard title="RDV Pris" value={currentData.kpis.rdvPris} Icon={Briefcase} color="text-sky-600" />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <StatCard title="Portes Visitées" value={currentData.kpis.portesVisitees} Icon={BarChart3} color="text-orange-600" />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <StatCard title="Taux de Conclusion" value={currentData.kpis.tauxConclusionGlobal} Icon={Target} suffix="%" color="text-violet-600" />
                    </motion.div>
                </div>
            </section>

            {/* Graphiques avec design moderne */}
            <div className="grid grid-cols-1 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Card className="backdrop-blur bg-white/90 shadow-lg border border-blue-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-200 py-6 px-6">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-semibold text-gray-900">Contrats par Équipe</CardTitle>
                                    <CardDescription className="text-sm text-gray-600">Répartition des contrats signés par équipe</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <GenericBarChart
                                title="Contrats par Équipe"
                                data={currentData.charts.contratsParEquipe}
                                xAxisDataKey="name"
                                bars={[
                                    { dataKey: 'value', fill: '#2563eb', name: 'Contrats' }
                                ]}
                            />
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="backdrop-blur bg-white/90 shadow-lg border border-blue-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-200 py-6 px-6">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                                    <BarChart3 className="h-4 w-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-semibold text-gray-900">Répartition des Contrats par Manager</CardTitle>
                                    <CardDescription className="text-sm text-gray-600">Pourcentage des contrats attribués à chaque manager</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <GenericPieChart
                                title="Répartition des Contrats par Manager"
                                data={currentData.charts.repartitionParManager}
                                dataKey="value"
                                nameKey="name"
                                colors={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']}
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Classements avec design moderne */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-1 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
                    <h2 className="text-2xl font-bold text-gray-900">Classements</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <LeaderboardTable title="Top Managers" description="Basé sur le nombre de contrats signés par leurs équipes." data={currentData.leaderboards.managers} unit="Contrats" />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                    >
                        <LeaderboardTable title="Top Équipes" description="Basé sur le nombre total de contrats signés." data={currentData.leaderboards.equipes} unit="Contrats" />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 }}
                    >
                        <LeaderboardTable title="Top Commerciaux" description="Basé sur leurs contrats signés individuels." data={currentData.leaderboards.commerciaux} unit="Contrats" />
                    </motion.div>
                </div>
            </section>
        </motion.div>
    );
};

export default StatistiquesPage;