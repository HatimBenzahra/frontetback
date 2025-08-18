

import { useEffect, useState } from 'react';

// --- Imports des Composants ---
import StatCard from '@/components/ui-admin/StatCard';

import { GenericBarChart } from '@/components/charts/GenericBarChart';
import { Badge } from "@/components/ui-admin/badge";
import { Button } from "@/components/ui-admin/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';

// --- Imports des Icônes ---
import { 
    BarChart3, Briefcase, FileSignature, Sparkles, Target,
    Award, ClipboardCheck, Percent, UserCheck
} from 'lucide-react';

// --- Imports des Settings ---
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-admin/select';
import { statisticsService } from '@/services/statistics.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';
import { Loader2 } from 'lucide-react';
import { CommercialProgressCard } from '@/components/ui-admin/CommercialProgressCard';
import { CountdownCard } from '@/components/ui-admin/CountdownCard';

// --- Types pour les données du tableau de bord ---
type ActiviteRecenteItem = {
  id: number;
  commercial: string;
  action: string;
  type: string;
  temps: string;
};





const ActivityBadge = ({ type }: { type: string }) => {
    switch (type) {
        case 'CONTRAT': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Contrat</Badge>;
        case 'RDV': return <Badge className="bg-sky-100 text-sky-800 border-sky-300">RDV</Badge>;
        case 'REFUS': return <Badge className="bg-red-100 text-red-800 border-red-300">Refus</Badge>;
        default: return <Badge variant="secondary">{type}</Badge>;
    }
};




const DashboardAdmin = () => {
    const { settings } = useDashboardSettings();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [repassageData, setRepassageData] = useState<any>(null);
    const [chartPeriod, setChartPeriod] = useState<string>('week');
    const [chartsLoading, setChartsLoading] = useState(false);
    const [commercialsProgress, setCommercialsProgress] = useState<any>(null);
    const [activityPage, setActivityPage] = useState(1);
    const activityItemsPerPage = 5;
    const [currentGlobalGoal, setCurrentGlobalGoal] = useState<any>(null);



    useEffect(() => {
        const loadAllData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Charger toutes les données en parallèle
                const [dashboardData, chartsData, progressData, goalData] = await Promise.all([
                    statisticsService.getDashboardStats(settings.defaultTimeFilter),
                    Promise.all([
                        statisticsService.getGlobalPerformanceChart(chartPeriod),
                        statisticsService.getRepassageChart(chartPeriod)
                    ]),
                    statisticsService.getCommercialsProgress(settings.defaultTimeFilter),
                    assignmentGoalsService.getCurrentGlobalGoal()
                ]);
                
                // Mettre à jour tous les states
                setDashboardData(dashboardData);
                setPerformanceData(chartsData[0]);
                setRepassageData(chartsData[1]);
                setCommercialsProgress(progressData);
                setCurrentGlobalGoal(goalData);
                
            } catch (err) {
                setError('Erreur lors du chargement des données');
                console.error('Error loading dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadAllData();
    }, [settings.defaultTimeFilter]);

    useEffect(() => {
        const loadChartsData = async () => {
            try {
                setChartsLoading(true);
                const [perfData, repassData] = await Promise.all([
                    statisticsService.getGlobalPerformanceChart(chartPeriod),
                    statisticsService.getRepassageChart(chartPeriod)
                ]);
                setPerformanceData(perfData);
                setRepassageData(repassData);
            } catch (err) {
                console.error('Error fetching charts data:', err);
            } finally {
                setChartsLoading(false);
            }
        };
        
        loadChartsData();
    }, [chartPeriod]);

    useEffect(() => {
        if (settings.autoRefresh && !loading) {
            const timer = setInterval(async () => {
                try {
                    const [dashboardData, chartsData, progressData, goalData] = await Promise.all([
                        statisticsService.getDashboardStats(settings.defaultTimeFilter),
                        Promise.all([
                            statisticsService.getGlobalPerformanceChart(chartPeriod),
                            statisticsService.getRepassageChart(chartPeriod)
                        ]),
                        statisticsService.getCommercialsProgress(settings.defaultTimeFilter),
                        assignmentGoalsService.getCurrentGlobalGoal()
                    ]);
                    
                    setDashboardData(dashboardData);
                    setPerformanceData(chartsData[0]);
                    setRepassageData(chartsData[1]);
                    setCommercialsProgress(progressData);
                    setCurrentGlobalGoal(goalData);
                } catch (err) {
                    console.error('Error refreshing dashboard data:', err);
                }
            }, settings.refreshInterval * 60 * 1000);
            return () => clearInterval(timer);
        }
    }, [settings.autoRefresh, settings.refreshInterval, loading, chartPeriod]);
    
    const getTimeFilterLabel = (filter: string): string => {
        const labels: Record<string, string> = {
            week: 'Semaine actuelle',
            month: 'Mois actuel',
            quarter: 'Trimestre actuel',
            year: 'Année actuelle'
        };
        return labels[filter] || 'Mois actuel';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96 bg-zinc-50/50 p-4 sm:p-6 rounded-xl">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-gray-600">Chargement des données du dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-96 bg-zinc-50/50 p-4 sm:p-6 rounded-xl">
                <div className="flex flex-col items-center gap-4 text-red-600">
                    <p className="text-lg font-semibold">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                        Réessayer
                    </button>
                </div>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="flex items-center justify-center min-h-96 bg-zinc-50/50 p-4 sm:p-6 rounded-xl">
                <p className="text-gray-600">Aucune donnée disponible</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 bg-zinc-50/50 p-4 sm:p-6 rounded-xl">
            <div className="flex flex-wrap gap-4 justify-between items-center animate-in fade-in duration-500 border-b pb-4">
                <h2 className="text-2xl font-semibold flex items-baseline gap-3 text-zinc-900">
                    <BarChart3 className="h-6 w-6 text-primary self-center"/>
                    <span>Statistiques - {getTimeFilterLabel(settings.defaultTimeFilter)}</span>
                </h2>
            </div>

            {settings.statsVisibility.showCommercialStats && (
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-900">Indicateurs Commerciaux</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 [animation-delay:100ms] duration-500">
                    <StatCard title="Contrats Signés" value={dashboardData.stats.contratsSignes} Icon={FileSignature} color="text-emerald-500" />
                    <StatCard title="RDV Pris" value={dashboardData.stats.rdvPris} Icon={Briefcase} color="text-sky-500" />
                    <StatCard title="Taux de Signature" value={dashboardData.stats.tauxSignature} Icon={Sparkles} suffix="%" color="text-violet-500" />
                    <StatCard title="Performance Moyenne" value={dashboardData.stats.perfMoyenne} Icon={Target} suffix="%" color="text-amber-500" />
                </div>
            </section>
            )}
            
            {settings.statsVisibility.showManagerStats && (
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-900">Indicateurs Managers</h3>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 [animation-delay:200ms] duration-500">
                    <Card>
                      <CardHeader>
                        <CardTitle>Meilleur Manager</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center">
                        <Award className="h-6 w-6 text-yellow-500 mb-2" />
                        <span className="text-lg font-semibold">{dashboardData.managerStats.meilleurManager}</span>
                      </CardContent>
                    </Card>
                    <StatCard title="Taux Conclusion Moyen" value={dashboardData.managerStats.tauxConclusionMoyen} Icon={Percent} suffix="%" color="text-green-500" />
                    <StatCard title="RDV Moyen / Manager" value={dashboardData.managerStats.rdvMoyen} Icon={ClipboardCheck} color="text-blue-500" />
                    <StatCard title="Effectif total des managers" value={dashboardData.managerStats.effectifTotal} Icon={UserCheck} color="text-indigo-500" />
                </div>
            </section>
            )}

            {settings.statsVisibility.showActivityFeed && (
            <section className="animate-in fade-in-0 [animation-delay:300ms] duration-500">
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                    <Card className="bg-white border border-gray-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-gray-900">Flux d'activité récent</CardTitle>
                            <CardDescription className="text-sm text-gray-600">Les dernières actions importantes enregistrées</CardDescription>
                        </CardHeader>
                    <CardContent className="pt-0">
                        {dashboardData.activiteRecente && dashboardData.activiteRecente.length > 0 ? (
                            <div className="space-y-3">
                                {(() => {
                                    const startIndex = (activityPage - 1) * activityItemsPerPage;
                                    const endIndex = startIndex + activityItemsPerPage;
                                    const currentItems = dashboardData.activiteRecente.slice(startIndex, endIndex);
                                    const totalPages = Math.ceil(dashboardData.activiteRecente.length / activityItemsPerPage);
                                    
                                    return (
                                        <>
                                            {currentItems.map((item: ActiviteRecenteItem) => (
                                                <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <div className="font-medium text-gray-900 min-w-0">{item.commercial}</div>
                                                        <ActivityBadge type={item.type} />
                                                    </div>
                                                    <div className="text-sm text-gray-500 whitespace-nowrap">{item.temps}</div>
                                                </div>
                                            ))}
                                            
                                            {totalPages > 1 && (
                                                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                                    <div className="text-sm text-gray-600">
                                                        Page {activityPage} sur {totalPages} ({dashboardData.activiteRecente.length} éléments)
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                                                            disabled={activityPage === 1}
                                                        >
                                                            <ChevronLeft className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setActivityPage(prev => Math.min(totalPages, prev + 1))}
                                                            disabled={activityPage === totalPages}
                                                        >
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <div className="text-gray-400 mb-2">📋</div>
                                <p>Aucune activité récente</p>
                            </div>
                        )}
                    </CardContent>
                    </Card>
                    
                    <div className="lg:col-span-2">
                        <CountdownCard 
                            currentGlobalGoal={currentGlobalGoal}
                            isLoading={loading}
                        />
                    </div>
                </div>
            </section>
            )}
            
            {/* Filtres pour les graphiques */}
            <section className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Analyses de Performance</h3>
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">Période :</label>
                        <Select value={chartPeriod} onValueChange={setChartPeriod}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="week">Cette semaine</SelectItem>
                                <SelectItem value="month">Ce mois</SelectItem>
                                <SelectItem value="year">Cette année</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {chartsLoading ? (
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                        <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {settings.chartVisibility.showPerformanceChart && performanceData && (
                            <Card className="bg-white border border-gray-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Performance Globale - {chartPeriod === 'week' ? 'Par Jour' : chartPeriod === 'month' ? 'Par Semaine' : 'Par Mois'}</CardTitle>
                                    <CardDescription>Activité de tous les commerciaux combinés</CardDescription>
                                </CardHeader>
                                <CardContent className="h-80">
                                    <GenericBarChart
                                        title=""
                                        data={performanceData}
                                        xAxisDataKey="periode"
                                        bars={[
                                            { dataKey: 'Portes Visitées', fill: '#3b82f6', name: 'Portes Visitées' },
                                            { dataKey: 'Contrats Signés', fill: '#10b981', name: 'Contrats Signés' },
                                            { dataKey: 'RDV Pris', fill: '#f59e0b', name: 'RDV Pris' }
                                        ]}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {settings.chartVisibility.showRepassageChart && repassageData && (
                            <Card className="bg-white border border-gray-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Repassages - {chartPeriod === 'week' ? 'Par Jour' : chartPeriod === 'month' ? 'Par Semaine' : 'Par Mois'}</CardTitle>
                                    <CardDescription>Nombre d'immeubles repassés (visités plusieurs fois)</CardDescription>
                                </CardHeader>
                                <CardContent className="h-80">
                                    <GenericBarChart
                                        title=""
                                        data={repassageData}
                                        xAxisDataKey="periode"
                                        bars={[
                                            { dataKey: 'Nombre de Repassages', fill: '#8b5cf6', name: 'Repassages' }
                                        ]}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </section>
            
            {/* Progress des commerciaux vers l'objectif global */}
            {settings.statsVisibility.showCommercialsProgress && (
            <section className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Contribution à l'Objectif Global</h3>
                        {commercialsProgress && (
                            <div className="text-sm text-gray-600 mt-1">
                                Objectif global: <span className="font-semibold text-green-600">{commercialsProgress.globalGoal} contrats</span>
                            </div>
                        )}
                    </div>
                    <div className="text-sm text-gray-500">
                        Période: {getTimeFilterLabel(settings.defaultTimeFilter)}
                    </div>
                </div>

                <CommercialProgressCard 
                    data={commercialsProgress || []} 
                    title="" 
                    loading={false}
                />
            </section>
            )}
        </div>
    );
};

export default DashboardAdmin;