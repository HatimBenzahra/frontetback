// src/pages/manager/DashboardManager.tsx
import { useEffect, useState } from 'react';

// --- Imports des Composants ---
import StatCard from '@/components/ui-admin/StatCard';
import { GenericLineChart } from '@/components/charts/GenericLineChart';
import { Badge } from "@/components/ui-admin/badge";
import { Button } from "@/components/ui-admin/button";
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';

// --- Imports des Icônes ---
import { 
    Briefcase, FileSignature, Target,
    Award, ClipboardCheck, Percent, UserCheck, Users
} from 'lucide-react';

// --- Imports des Services ---
import { statisticsService } from '@/services/statistics.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';
import { Loader2 } from 'lucide-react';
import { CountdownCard } from '@/components/ui-admin/CountdownCard';
import { AssignmentStatusCard } from '@/components/ui-admin/AssignmentStatusCard';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';

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

const DashboardManager = () => {
    const { user } = useAuth();
    const { setBreadcrumbs } = useBreadcrumb();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
          const [performanceData, setPerformanceData] = useState<any>(null);
      const [chartPeriod, setChartPeriod] = useState<string>('week');
      const [chartsLoading] = useState(false);
      const [activityPage, setActivityPage] = useState(1);
      const activityItemsPerPage = 5;
      const [currentGlobalGoal, setCurrentGlobalGoal] = useState<any>(null);
      const [assignmentRefreshTrigger, setAssignmentRefreshTrigger] = useState<number>(0);

      // Fonction pour obtenir les données de performance selon la période
      const getPerformanceDataForPeriod = () => {
          if (!performanceData) return [];
          
          switch (chartPeriod) {
              case 'week':
                  return performanceData.week || [];
              case 'month':
                  return performanceData.month || [];
              case 'year':
                  return performanceData.year || [];
              default:
                  return performanceData.month || [];
          }
      };

      // Rafraîchissement manuel
      const handleManualRefresh = async () => {
          if (!user?.id) return;
          
          try {
              setLoading(true);
              setError(null);
              const [managerStatsResp, managerHistoryResp, goalDataResp] = await Promise.all([
                  statisticsService.getStatsForManager(user.id),
                  statisticsService.getManagerPerformanceHistory(user.id),
                  assignmentGoalsService.getCurrentGlobalGoal()
              ]);
              setDashboardData(managerStatsResp);
              setPerformanceData(managerHistoryResp);
              setCurrentGlobalGoal(goalDataResp);
              setAssignmentRefreshTrigger(prev => prev + 1);
          } catch (err) {
              setError('Erreur lors du chargement des données');
              console.error('Error loading manager dashboard data:', err);
          } finally {
              setLoading(false);
          }
      };

    useEffect(() => {
        const loadManagerData = async () => {
            if (!user?.id) return;
            
            try {
                setLoading(true);
                setError(null);
                
                const [managerStats, managerHistory, goalData] = await Promise.all([
                    statisticsService.getStatsForManager(user.id),
                    statisticsService.getManagerPerformanceHistory(user.id),
                    assignmentGoalsService.getCurrentGlobalGoal()
                ]);
                
                setDashboardData(managerStats);
                setPerformanceData(managerHistory);
                setCurrentGlobalGoal(goalData);
                setAssignmentRefreshTrigger(prev => prev + 1);
                
            } catch (err) {
                setError('Erreur lors du chargement des données');
                console.error('Error loading manager dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadManagerData();
    }, [user?.id]);

    // Configuration des breadcrumbs
    useEffect(() => {
        setBreadcrumbs([
            { label: 'Espace Manager', path: '/manager' },
            { label: 'Tableau de Bord', path: '/manager' }
        ]);
    }, [setBreadcrumbs]);

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
        return <AdminPageSkeleton hasHeader hasCards hasCharts cardsCount={6} chartsCount={2} />;
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
        <div className="space-y-8 bg-gradient-to-br from-white via-green-50/60 to-green-100/30 p-4 sm:p-6 rounded-2xl border border-green-100">
            <div className="flex flex-wrap gap-4 justify-between items-center animate-in fade-in duration-500 border-b border-green-100/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-600/90 text-white flex items-center justify-center shadow-lg">
                    <Users className="h-5 w-5"/>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900">Mes Équipes & Commerciaux</h2>
                    <p className="text-sm text-zinc-600">{getTimeFilterLabel('month')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="!border-green-200 !text-green-700 hover:!bg-green-50 hover:!border-green-300 focus:!ring-green-500" 
                    style={{
                      borderColor: '#bbf7d0',
                      color: '#15803d',
                    }}
                    onClick={handleManualRefresh}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> 
                    {loading ? 'Actualisation...' : 'Actualiser'}
                  </Button>
                </div>
            </div>

            {/* Section Indicateurs des équipes */}
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-900">Performance de mes équipes</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 [animation-delay:100ms] duration-500">
                    <StatCard title="Contrats Signés" value={dashboardData.totalContracts || 0} Icon={FileSignature} color="text-emerald-500" />
                    <StatCard title="RDV Pris" value={dashboardData.totalRdv || 0} Icon={Briefcase} color="text-sky-500" />
                    <StatCard title="Mes Commerciaux" value={dashboardData.totalCommerciaux || 0} Icon={Users} color="text-violet-500" />
                    <StatCard title="Mes Équipes" value={dashboardData.totalEquipes || 0} Icon={UserCheck} color="text-amber-500" />
                </div>
            </section>
            
            {/* Section Rendez-vous de mes commerciaux */}
            <section className="animate-in fade-in-0 [animation-delay:250ms] duration-500">
                <Card className="bg-white border border-green-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-900">Rendez-vous de mes équipes</CardTitle>
                        <CardDescription className="text-sm text-gray-600">Aperçu des rendez-vous de cette semaine</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="text-2xl font-bold text-green-700">{dashboardData.totalRdv || 0}</div>
                                <div className="text-sm text-green-600">Total RDV</div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-2xl font-bold text-blue-700">{dashboardData.averageRdvPerTeam || 0}</div>
                                <div className="text-sm text-blue-600">Moyenne par équipe</div>
                            </div>
                            <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="text-2xl font-bold text-amber-700">{dashboardData.averageRate || 0}%</div>
                                <div className="text-sm text-amber-600">Taux de conversion</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>
            
            {/* Section Performance des équipes */}
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-900">Performance par Équipe</h3>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 [animation-delay:200ms] duration-500">
                    <Card>
                      <CardHeader>
                        <CardTitle>Meilleure Équipe</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center">
                        <Award className="h-6 w-6 text-yellow-500 mb-2" />
                        <span className="text-lg font-semibold">{dashboardData.bestTeam || 'N/A'}</span>
                      </CardContent>
                    </Card>
                    <StatCard title="Taux Moyen" value={dashboardData.averageRate || 0} Icon={Percent} suffix="%" color="text-green-500" />
                    <StatCard title="RDV Moyen / Équipe" value={dashboardData.averageRdvPerTeam || 0} Icon={ClipboardCheck} color="text-blue-500" />
                    <StatCard title="Portes Visitées" value={dashboardData.totalPortes || 0} Icon={Target} color="text-indigo-500" />
                </div>
            </section>

            {/* Section Activité récente de mes commerciaux */}
            <section className="animate-in fade-in-0 [animation-delay:300ms] duration-500">
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                    <Card className="bg-white border border-gray-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold text-gray-900">Activité de mes commerciaux</CardTitle>
                            <CardDescription className="text-sm text-gray-600">Les dernières actions de mes équipes</CardDescription>
                        </CardHeader>
                    <CardContent className="pt-0">
                        {dashboardData.recentActivity && dashboardData.recentActivity.length > 0 ? (
                            <div className="space-y-3">
                                {(() => {
                                    const startIndex = (activityPage - 1) * activityItemsPerPage;
                                    const endIndex = startIndex + activityItemsPerPage;
                                    const currentItems = dashboardData.recentActivity.slice(startIndex, endIndex);
                                    const totalPages = Math.ceil(dashboardData.recentActivity.length / activityItemsPerPage);
                                    
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
                                                        Page {activityPage} sur {totalPages} ({dashboardData.recentActivity.length} éléments)
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
                    
                    <CountdownCard 
                        currentGlobalGoal={currentGlobalGoal}
                        isLoading={loading}
                        refreshTrigger={assignmentRefreshTrigger}
                    />
                </div>
            </section>
            
            {/* Section Graphiques des performances */}
            <section className="backdrop-blur bg-white/90 rounded-2xl p-6 shadow-lg border border-green-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Performance de mes Équipes</h3>
                    <div className="flex items-center gap-2">
                        <button
                          onClick={() => setChartPeriod('week')}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${chartPeriod==='week' ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-green-700 border-green-200 hover:bg-green-50'}`}
                        >Semaine</button>
                        <button
                          onClick={() => setChartPeriod('month')}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${chartPeriod==='month' ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-green-700 border-green-200 hover:bg-green-50'}`}
                        >Mois</button>
                        <button
                          onClick={() => setChartPeriod('year')}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${chartPeriod==='year' ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-green-700 border-green-200 hover:bg-green-50'}`}
                        >Année</button>
                    </div>
                </div>

                {chartsLoading ? (
                    <div className="grid gap-6 md:grid-cols-1">
                        <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    </div>
                ) : (
                                          <div className="grid gap-6 md:grid-cols-1">
                          {performanceData && getPerformanceDataForPeriod().length > 0 && (
                              <Card className="bg-white/90 border border-green-100 shadow-sm rounded-2xl">
                                  <CardHeader>
                                      <CardTitle>Performance de mes Équipes - {chartPeriod === 'week' ? 'Par Semaine' : chartPeriod === 'month' ? 'Par Mois' : 'Par Année'}</CardTitle>
                                      <CardDescription>Activité de tous mes commerciaux combinés</CardDescription>
                                  </CardHeader>
                                  <CardContent className="h-80">
                                      <GenericLineChart
                                          data={getPerformanceDataForPeriod()}
                                          xAxisDataKey="periode"
                                          lines={[
                                              { dataKey: 'Contrats Signés', stroke: '#10b981', name: 'Contrats Signés' },
                                              { dataKey: 'RDV Pris', stroke: '#f59e0b', name: 'RDV Pris' }
                                          ]}
                                      />
                                  </CardContent>
                              </Card>
                          )}
                      </div>
                )}
            </section>
        </div>
    );
};

export default DashboardManager;