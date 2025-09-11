import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { GenericPieChart } from '@/components/charts/GenericPieChart';
import { GenericBarChart } from '@/components/charts/GenericBarChart';
import { zoneService, type ZonesStatisticsResponse } from '@/services/zone.service';
import { MapPin, TrendingDown, TrendingUp, Target } from 'lucide-react';
import StatCard from '@/components/ui-admin/StatCard';

interface ZonesStatsChartsProps {
  className?: string;
}

export const ZonesStatsCharts = ({ className }: ZonesStatsChartsProps) => {
  const [zonesStats, setZonesStats] = useState<ZonesStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchZonesStatistics = async () => {
      try {
        setLoading(true);
        const data = await zoneService.getZonesStatistics();
        setZonesStats(data);
      } catch (err) {
        console.error('Erreur lors de la récupération des statistiques des zones:', err);
        setError('Impossible de charger les statistiques des zones');
      } finally {
        setLoading(false);
      }
    };

    fetchZonesStatistics();
  }, []);

  if (loading) {
    return (
      <div className={className}>
        <div className="grid gap-6">
          <div className="h-96 bg-gray-100 animate-pulse rounded-lg"></div>
          <div className="h-96 bg-gray-100 animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !zonesStats) {
    return (
      <div className={className}>
        <Card className="h-96 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{error || 'Aucune donnée disponible'}</p>
          </div>
        </Card>
      </div>
    );
  }

  // Préparer les données pour le graphique circulaire des contrats signés par zone
  const contratsParZoneData = zonesStats.zones
    .filter(zone => zone.stats.totalContratsSignes > 0)
    .map(zone => ({
      name: zone.nom,
      value: zone.stats.totalContratsSignes,
      color: zone.couleur,
    }));

  // Préparer les données pour le graphique des zones avec le plus de refus
  const refusParZoneData = zonesStats.zones
    .filter(zone => zone.stats.totalRefus > 0)
    .sort((a, b) => b.stats.totalRefus - a.stats.totalRefus)
    .slice(0, 10) // Top 10 des zones avec le plus de refus
    .map(zone => ({
      name: zone.nom,
      refus: zone.stats.totalRefus,
      tauxRefus: zone.tauxRefus,
    }));

  // Préparer les données pour le graphique des zones les plus performantes (taux de réussite)
  const performanceParZoneData = zonesStats.zones
    .filter(zone => zone.stats.totalPortesVisitees > 0)
    .sort((a, b) => b.tauxReussite - a.tauxReussite)
    .slice(0, 10) // Top 10 des zones les plus performantes
    .map(zone => ({
      name: zone.nom,
      tauxReussite: Number(zone.tauxReussite.toFixed(1)),
      contratsSignes: zone.stats.totalContratsSignes,
    }));

  // Couleurs pour les graphiques
  const pieColors = contratsParZoneData.map(item => item.color || '#3b82f6');

  return (
    <div className={className}>
      <div className="space-y-8">
        {/* KPIs des zones */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">Statistiques des Zones</h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard 
                title="Zones Actives" 
                value={zonesStats.zones.filter(z => z.stats.totalPortesVisitees > 0).length} 
                Icon={MapPin} 
                color="text-blue-600" 
              />
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <StatCard 
                title="Contrats Totaux" 
                value={zonesStats.totaux.totalContratsSignes} 
                Icon={TrendingUp} 
                color="text-emerald-600" 
              />
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <StatCard 
                title="Refus Totaux" 
                value={zonesStats.totaux.totalRefus} 
                Icon={TrendingDown} 
                color="text-red-600" 
              />
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <StatCard 
                title="Taux Global" 
                value={zonesStats.totaux.totalPortesVisitees > 0 ? 
                  Number(((zonesStats.totaux.totalContratsSignes / zonesStats.totaux.totalPortesVisitees) * 100).toFixed(1)) : 0} 
                Icon={Target} 
                suffix="%" 
                color="text-violet-600" 
              />
            </motion.div>
          </div>
        </section>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique circulaire des contrats par zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="backdrop-blur bg-white/90 shadow-lg border border-blue-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-b border-emerald-200 py-6 px-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Contrats Signés par Zone</CardTitle>
                    <CardDescription className="text-sm text-gray-600">Répartition des contrats entre les zones les plus performantes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {contratsParZoneData.length > 0 ? (
                  <GenericPieChart
                    title=""
                    data={contratsParZoneData}
                    dataKey="value"
                    nameKey="name"
                    colors={pieColors}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucun contrat signé dans les zones</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Graphique des zones avec le plus de refus */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="backdrop-blur bg-white/90 shadow-lg border border-blue-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl">
              <CardHeader className="bg-gradient-to-r from-red-50 to-red-100/50 border-b border-red-200 py-6 px-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-600 text-white flex items-center justify-center">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Zones avec le Plus de Refus</CardTitle>
                    <CardDescription className="text-sm text-gray-600">Identification des zones nécessitant une amélioration</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {refusParZoneData.length > 0 ? (
                  <GenericBarChart
                    title=""
                    data={refusParZoneData}
                    xAxisDataKey="name"
                    bars={[
                      { dataKey: 'refus', fill: '#ef4444', name: 'Nombre de Refus' }
                    ]}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucun refus enregistré dans les zones</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Graphique des zones les plus performantes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="backdrop-blur bg-white/90 shadow-lg border border-blue-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-violet-100/50 border-b border-violet-200 py-6 px-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-violet-600 text-white flex items-center justify-center">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Zones les Plus Performantes</CardTitle>
                  <CardDescription className="text-sm text-gray-600">Taux de réussite des zones les plus rentables</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {performanceParZoneData.length > 0 ? (
                <GenericBarChart
                  title=""
                  data={performanceParZoneData}
                  xAxisDataKey="name"
                  bars={[
                    { dataKey: 'tauxReussite', fill: '#8b5cf6', name: 'Taux de Réussite (%)' }
                  ]}
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune donnée de performance disponible</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};