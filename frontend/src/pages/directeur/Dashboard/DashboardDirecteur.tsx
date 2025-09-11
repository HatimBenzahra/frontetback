import { useEffect, useState } from 'react';

// --- Imports des Composants ---
import StatCard from '@/components/ui-admin/StatCard';

import { GenericBarChart } from '@/components/charts/GenericBarChart';
import { GenericLineChart } from '@/components/charts/GenericLineChart';
import { Badge } from "@/components/ui-admin/badge";
import { Button } from "@/components/ui-admin/button";
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';

// --- Imports des Icônes ---
import { 
    BarChart3, Briefcase, FileSignature, Sparkles, Target,
    Award, ClipboardCheck, Percent, UserCheck
} from 'lucide-react';

// --- Imports des Settings ---
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { directeurSpaceService } from '@/services/directeur-space.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';
import { Loader2 } from 'lucide-react';
import { CommercialProgressCard } from '@/components/ui-admin/CommercialProgressCard';
import { CountdownCard } from '@/components/ui-admin/CountdownCard';
import { AssignmentStatusCard } from '@/components/ui-admin/AssignmentStatusCard';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import RendezVousAdmin from '@/components/ui-admin/RendezVousAdmin';

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

const DashboardDirecteur = () => {
    const { settings } = useDashboardSettings();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [repassageData, setRepassageData] = useState<any>(null);
    const [chartPeriod, setChartPeriod] = useState<string>(settings.chartDefaultPeriod || 'week');
    const [chartsLoading, setChartsLoading] = useState(false);
    const [commercialsProgress, setCommercialsProgress] = useState<any>(null);
    const [activityPage, setActivityPage] = useState(1);
    const activityItemsPerPage = settings.activityItemsPerPage || 5;
    const [currentGlobalGoal, setCurrentGlobalGoal] = useState<any>(null);
    const [assignmentRefreshTrigger, setAssignmentRefreshTrigger] = useState<number>(0);

    // Rafraîchissement manuel pour afficher le skeleton
    const handleManualRefresh = async () => {
        try {
            setLoading(true);
            setError(null);
            const [globalStats, managersStats, performanceHistory, progressDataResp, goalDataResp] = await Promise.all([
                directeurSpaceService.getGlobalStats(),
                directeurSpaceService.getManagersStats(),
                directeurSpaceService.getPerformanceHistory(),
                directeurSpaceService.getCommerciauxStats(),
                assignmentGoalsService.getCurrentGlobalGoal()
            ]);
            
            // Trouver le meilleur manager basé sur le taux de conversion
            const meilleurManager = managersStats.length > 0 
                ? managersStats.reduce((best: any, current: any) => 
                    (current.tauxConversion || 0) > (best.tauxConversion || 0) ? current : best
                  )
                : null;
            
            // Calculer le taux de conclusion moyen des managers
            const tauxConclusionMoyen = managersStats.length > 0
                ? managersStats.reduce((sum: number, manager: any) => sum + (manager.tauxConversion || 0), 0) / managersStats.length
                : 0;
            
            // Transformer les données pour correspondre au format attendu par le frontend
            const dashboardDataResp = {
                stats: {
                    contratsSignes: globalStats.totalContrats || 0,
                    rdvPris: globalStats.totalRdv || 0,
                    tauxSignature: globalStats.tauxConversion || 0,
                    perfMoyenne: globalStats.tauxConversion || 0
                },
                managerStats: {
                    meilleurManager: meilleurManager ? `${meilleurManager.prenom} ${meilleurManager.nom}` : "Aucun manager",
                    tauxConclusionMoyen: Math.round(tauxConclusionMoyen * 100) / 100,
                    rdvMoyen: Math.round((globalStats.totalRdv || 0) / (globalStats.totalManagers || 1)),
                    effectifTotal: globalStats.totalManagers || 0
                },
                activiteRecente: [] // Pour l'instant, retourner un tableau vide
            };
            
            const chartsDataResp = [
                performanceHistory[chartPeriod as keyof typeof performanceHistory] || [],
                [] // Repassage chart - pas encore implémenté
            ];
            setDashboardData(dashboardDataResp);
            setPerformanceData(chartsDataResp[0]);
            setRepassageData(chartsDataResp[1]);
            setCommercialsProgress(progressDataResp);
            setCurrentGlobalGoal(goalDataResp);
            // Déclencher le rafraîchissement des assignations
            setAssignmentRefreshTrigger(prev => prev + 1);
        } catch (err) {
            setError('Erreur lors du chargement des données');
            console.error('Error loading directeur dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadAllData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Charger toutes les données en parallèle
                const [globalStats, managersStats, performanceHistory, progressData, goalData] = await Promise.all([
                    directeurSpaceService.getGlobalStats(),
                    directeurSpaceService.getManagersStats(),
                    directeurSpaceService.getPerformanceHistory(),
                    directeurSpaceService.getCommerciauxStats(),
                    assignmentGoalsService.getCurrentGlobalGoal()
                ]);
                
                // Trouver le meilleur manager basé sur le taux de conversion
                const meilleurManager = managersStats.length > 0 
                    ? managersStats.reduce((best: any, current: any) => 
                        (current.tauxConversion || 0) > (best.tauxConversion || 0) ? current : best
                      )
                    : null;
                
                // Calculer le taux de conclusion moyen des managers
                const tauxConclusionMoyen = managersStats.length > 0
                    ? managersStats.reduce((sum: number, manager: any) => sum + (manager.tauxConversion || 0), 0) / managersStats.length
                    : 0;
                
                // Transformer les données pour correspondre au format attendu par le frontend
                const dashboardData = {
                    stats: {
                        contratsSignes: globalStats.totalContrats || 0,
                        rdvPris: globalStats.totalRdv || 0,
                        tauxSignature: globalStats.tauxConversion || 0,
                        perfMoyenne: globalStats.tauxConversion || 0
                    },
                    managerStats: {
                        meilleurManager: meilleurManager ? `${meilleurManager.prenom} ${meilleurManager.nom}` : "Aucun manager",
                        tauxConclusionMoyen: Math.round(tauxConclusionMoyen * 100) / 100,
                        rdvMoyen: Math.round((globalStats.totalRdv || 0) / (globalStats.totalManagers || 1)),
                        effectifTotal: globalStats.totalManagers || 0
                    },
                    activiteRecente: [] // Pour l'instant, retourner un tableau vide
                };
                
                // Mettre à jour tous les states
                setDashboardData(dashboardData);
                setPerformanceData(performanceHistory[chartPeriod as keyof typeof performanceHistory] || []);
                setRepassageData([]); // Repassage chart - pas encore implémenté
                setCommercialsProgress(progressData);
                setCurrentGlobalGoal(goalData);
                // Déclencher le rafraîchissement des assignations
                setAssignmentRefreshTrigger(prev => prev + 1);
                
            } catch (err) {
                setError('Erreur lors du chargement des données');
                console.error('Error loading directeur dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadAllData();
    }, [settings.defaultTimeFilter]);

    useEffect(() => {
        // synchroniser le period par défaut des graphiques avec les paramètres
        setChartPeriod(settings.chartDefaultPeriod || 'week');
        const loadChartsData = async () => {
            try {
                setChartsLoading(true);
                const performanceHistory = await directeurSpaceService.getPerformanceHistory();
                setPerformanceData(performanceHistory[chartPeriod as keyof typeof performanceHistory] || []);
                setRepassageData([]); // Repassage chart - pas encore implémenté
            } catch (err) {
                console.error('Error fetching directeur charts data:', err);
            } finally {
                setChartsLoading(false);
            }
        };
        
        loadChartsData();
    }, [chartPeriod, settings.chartDefaultPeriod]);

    useEffect(() => {
        if (settings.autoRefresh && !loading) {
            const timer = setInterval(async () => {
                try {
                    const [globalStats, managersStats, performanceHistory, progressData, goalData] = await Promise.all([
                        directeurSpaceService.getGlobalStats(),
                        directeurSpaceService.getManagersStats(),
                        directeurSpaceService.getPerformanceHistory(),
                        directeurSpaceService.getCommerciauxStats(),
                        assignmentGoalsService.getCurrentGlobalGoal()
                    ]);
                    
                    // Trouver le meilleur manager basé sur le taux de conversion
                    const meilleurManager = managersStats.length > 0 
                        ? managersStats.reduce((best: any, current: any) => 
                            (current.tauxConversion || 0) > (best.tauxConversion || 0) ? current : best
                          )
                        : null;
                    
                    // Calculer le taux de conclusion moyen des managers
                    const tauxConclusionMoyen = managersStats.length > 0
                        ? managersStats.reduce((sum: number, manager: any) => sum + (manager.tauxConversion || 0), 0) / managersStats.length
                        : 0;
                    
                    // Transformer les données pour correspondre au format attendu par le frontend
                    const dashboardData = {
                        stats: {
                            contratsSignes: globalStats.totalContrats || 0,
                            rdvPris: globalStats.totalRdv || 0,
                            tauxSignature: globalStats.tauxConversion || 0,
                            perfMoyenne: globalStats.tauxConversion || 0
                        },
                        managerStats: {
                            meilleurManager: meilleurManager ? `${meilleurManager.prenom} ${meilleurManager.nom}` : "Aucun manager",
                            tauxConclusionMoyen: Math.round(tauxConclusionMoyen * 100) / 100,
                            rdvMoyen: Math.round((globalStats.totalRdv || 0) / (globalStats.totalManagers || 1)),
                            effectifTotal: globalStats.totalManagers || 0
                        },
                        activiteRecente: [] // Pour l'instant, retourner un tableau vide
                    };
                    
                    const chartsData = [
                        performanceHistory[chartPeriod as keyof typeof performanceHistory] || [],
                        [] // Repassage chart - pas encore implémenté
                    ];
                    
                    setDashboardData(dashboardData);
                    setPerformanceData(chartsData[0]);
                    setRepassageData(chartsData[1]);
                    setCommercialsProgress(progressData);
                    setCurrentGlobalGoal(goalData);
                    // Déclencher le rafraîchissement des assignations
                    setAssignmentRefreshTrigger(prev => prev + 1);
                } catch (err) {
                    console.error('Error refreshing directeur dashboard data:', err);
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
        return <AdminPageSkeleton hasHeader hasCards hasCharts cardsCount={6} chartsCount={3} />;
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
        <div className="space-y-8 bg-gradient-to-br from-white via-purple-50/60 to-purple-100/30 p-4 sm:p-6 rounded-2xl border border-purple-100">
            <div className="flex flex-wrap gap-4 justify-between items-center animate-in fade-in duration-500 border-b border-purple-100/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-600/90 text-white flex items-center justify-center shadow-lg">
                    <BarChart3 className="h-5 w-5"/>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900">Vue d'ensemble - Directeur</h2>
                    <p className="text-sm text-zinc-600">{getTimeFilterLabel(settings.defaultTimeFilter)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="!border-purple-200 !text-purple-700 hover:!bg-purple-50 hover:!border-purple-300 focus:!ring-purple-500" 
                    style={{
                      borderColor: '#e9d5ff',
                      color: '#7c3aed',
                    }}
                    onClick={handleManualRefresh}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Actualisation...' : 'Actualiser'}
                  </Button>
                </div>
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
            
            {/* Section Rendez-vous de la semaine */}
            <section className="animate-in fade-in-0 [animation-delay:250ms] duration-500">
                <RendezVousAdmin />
            </section>
            
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
                                <div className="text-gray-400 mb-2">NULL</div>
                                <p>Aucune activité récente</p>
                            </div>
                        )}
                    </CardContent>
                    </Card>
                    
                    <AssignmentStatusCard 
                        isLoading={loading}
                        refreshTrigger={assignmentRefreshTrigger}
                    />
                    
                    {settings.showCountdownCard && (
                        <CountdownCard 
                            currentGlobalGoal={currentGlobalGoal}
                            isLoading={loading}
                            refreshTrigger={assignmentRefreshTrigger}
                        />
                    )}
                </div>
            </section>
            )}
            
            {/* Filtres pour les graphiques */}
            {settings.chartVisibility.showChartsSection && (
            <section className="backdrop-blur bg-white/90 rounded-2xl p-6 shadow-lg border border-purple-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Analyses de Performance</h3>
                    <div className="flex items-center gap-2">
                        <button
                          onClick={() => setChartPeriod('week')}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${chartPeriod==='week' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'}`}
                        >Semaine</button>
                        <button
                          onClick={() => setChartPeriod('month')}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${chartPeriod==='month' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'}`}
                        >Mois</button>
                        <button
                          onClick={() => setChartPeriod('year')}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${chartPeriod==='year' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'}`}
                        >Année</button>
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
                            <Card className="bg-white/90 border border-purple-100 shadow-sm rounded-2xl">
                                <CardHeader>
                                    <CardTitle>Performance de mes Équipes - {chartPeriod === 'week' ? 'Par Jour' : chartPeriod === 'month' ? 'Par Semaine' : 'Par Mois'}</CardTitle>
                                    <CardDescription>Activité de mes managers et commerciaux</CardDescription>
                                </CardHeader>
                                <CardContent className="h-80">
                                    <GenericBarChart
                                        title=""
                                        data={performanceData}
                                        xAxisDataKey="periode"
                                        bars={[
                                            { dataKey: 'Portes Visitées', fill: '#8b5cf6', name: 'Portes Visitées' },
                                            { dataKey: 'Contrats Signés', fill: '#10b981', name: 'Contrats Signés' },
                                            { dataKey: 'RDV Pris', fill: '#f59e0b', name: 'RDV Pris' }
                                        ]}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {settings.chartVisibility.showRepassageChart && repassageData && (
                            <Card className="bg-white/90 border border-purple-100 shadow-sm rounded-2xl">
                                <CardHeader>
                                    <CardTitle>Efficacité des Repassages - {chartPeriod === 'week' ? 'Par Jour' : chartPeriod === 'month' ? 'Par Semaine' : 'Par Mois'}</CardTitle>
                                    <CardDescription>Repassages de mes équipes convertis en contrats</CardDescription>
                                </CardHeader>
                                <CardContent className="h-80">
                                    <GenericLineChart
                                        data={repassageData}
                                        xAxisDataKey="periode"
                                        lines={[
                                            { dataKey: 'Repassages convertis en contrats', stroke: '#a855f7', name: 'Repassages convertis' }
                                        ]}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </section>
            )}
            
            {/* Progress des commerciaux vers l'objectif global */}
            {settings.statsVisibility.showCommercialsProgress && (
            <section className="backdrop-blur bg-white/90 rounded-2xl p-6 shadow-lg border border-purple-100">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Contribution à l'Objectif Global</h3>
                        {commercialsProgress && (
                            <div className="text-sm text-gray-600 mt-1">
                                {commercialsProgress.globalGoal > 0 ? (
                                    <>Objectif global: <span className="font-semibold text-purple-600">{commercialsProgress.globalGoal} contrats</span></>
                                ) : (
                                    <span className="font-semibold text-amber-600">Aucun objectif global défini</span>
                                )}
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

export default DashboardDirecteur;