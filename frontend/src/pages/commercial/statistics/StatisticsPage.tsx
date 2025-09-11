import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { statisticsService } from '@/services/statistics.service';
import StatCard from '@/components/ui-admin/StatCard';
import { GenericPieChart } from '@/components/charts/GenericPieChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { Building, DoorOpen, Handshake, Phone, Percent, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui-admin/tooltip';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui-admin/skeleton';

interface CommercialStats {
  kpis: {
    immeublesVisites: number;
    portesVisitees: number;
    contratsSignes: number;
    rdvPris: number;
    tauxDeConversion: number;
  };
  repartitionStatuts: {
    [key: string]: number;
  };
}

const PageSkeleton = () => (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="space-y-8 animate-pulse max-w-screen-2xl mx-auto">
            <Skeleton className="h-10 w-1/2 bg-slate-200 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl bg-slate-200" />)}
            </div>
            <Skeleton className="h-[500px] w-full rounded-2xl bg-slate-200" />
        </div>
    </div>
);

const statusColors: { [key: string]: string } = {
    CONTRAT: '#10b981',      // emerald-500
    RDV: '#f97316',            // orange-500
    ABSENT: '#64748b',         // slate-500
    REFUS: '#ef4444',          // red-500
    CURIEUX: '#8b5cf6',        // violet-500
    NON_VISITE: '#a1a1aa',     // zinc-400
};

const CommercialStatisticsPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (user?.id) {
      try {
        setLoading(true);
        const statsData = await statisticsService.getStatsForCommercial(user.id);
        setStats(statsData);
        setError(null);
      } catch (err) {
        setError('Erreur lors de la récupération des données.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    window.addEventListener('focus', fetchData);
    return () => window.removeEventListener('focus', fetchData);
  }, [fetchData]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.repartitionStatuts)
        .map(([name, value]) => ({ name, value: value as number }))
        .filter(item => item.value > 0);
  }, [stats]);

  const pieColors = useMemo(() => {
    return pieData.map(item => statusColors[item.name] || '#cccccc');
  }, [pieData]);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="text-red-500 text-center p-4 bg-red-50 h-screen">{error}</div>;

  return (
    <div className="bg-slate-50 min-h-screen">
        <motion.div 
            className="space-y-8 max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                <StatCard title="Immeubles Visitées" value={stats?.kpis.immeublesVisites || 0} Icon={Building} color="text-blue-500" />
                <StatCard title="Portes Visitées" value={stats?.kpis.portesVisitees || 0} Icon={DoorOpen} color="text-orange-500" />
                <StatCard title="Contrats Signés" value={stats?.kpis.contratsSignes || 0} Icon={Handshake} color="text-emerald-500" />
                <StatCard title="RDV Pris" value={stats?.kpis.rdvPris || 0} Icon={Phone} color="text-yellow-500" />
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="cursor-help">
                                <StatCard title="Taux de Conversion" value={stats?.kpis.tauxDeConversion || 0} Icon={Percent} suffix="%" color="text-purple-500" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Rapport entre contrats signés et portes visitées.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xl font-bold text-slate-900">Répartition des Statuts</CardTitle>
                    <CardDescription>
                        Visualisez la proportion de chaque statut sur l'ensemble de vos portes prospectées.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {pieData.length > 0 ? (
                        <div className="h-[450px] w-full">
                            <GenericPieChart
                                title=""
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                colors={pieColors}
                            />
                        </div>
                    ) : (
                        <div className="text-center py-20 col-span-full bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <Search className="mx-auto h-16 w-16 text-slate-400 mb-4" />
                            <p className="text-xl font-semibold text-slate-800">Aucune donnée de répartition</p>
                            <p className="text-slate-500 mt-2">Commencez la prospection pour voir vos statistiques.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    </div>
  );
};

export default CommercialStatisticsPage;