import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui-admin/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Badge } from '@/components/ui-admin/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target,
  Building2,
  UserCheck,
  Download,
  RefreshCw
} from 'lucide-react';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import StatCard from '@/components/ui-admin/StatCard';

// Types pour les statistiques
interface StatistiquesGlobales {
  totalManagers: number;
  totalEquipes: number;
  totalCommerciaux: number;
  totalImmeubles: number;
  performanceGlobale: number;
  objectifsAtteints: number;
  contratsSignes: number;
  tauxConversion: number;
}

interface PerformanceParManager {
  id: string;
  nom: string;
  prenom: string;
  performance: number;
  objectifsAtteints: number;
  contratsSignes: number;
  equipes: number;
  commerciaux: number;
}

interface PerformanceParEquipe {
  id: string;
  nom: string;
  manager: string;
  performance: number;
  objectifsAtteints: number;
  contratsSignes: number;
  commerciaux: number;
}

const StatistiquesPage = () => {
  const [statistiques, setStatistiques] = useState<StatistiquesGlobales | null>(null);
  const [performanceManagers, setPerformanceManagers] = useState<PerformanceParManager[]>([]);
  const [performanceEquipes, setPerformanceEquipes] = useState<PerformanceParEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    const loadStatistiques = async () => {
      setLoading(true);
      
      // Simuler un délai de chargement
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Données simulées
      setStatistiques({
        totalManagers: 8,
        totalEquipes: 24,
        totalCommerciaux: 72,
        totalImmeubles: 156,
        performanceGlobale: 85,
        objectifsAtteints: 78,
        contratsSignes: 234,
        tauxConversion: 12.5
      });

      setPerformanceManagers([
        {
          id: '1',
          nom: 'Dubois',
          prenom: 'Marie',
          performance: 88,
          objectifsAtteints: 82,
          contratsSignes: 45,
          equipes: 3,
          commerciaux: 12
        },
        {
          id: '2',
          nom: 'Martin',
          prenom: 'Jean',
          performance: 92,
          objectifsAtteints: 89,
          contratsSignes: 38,
          equipes: 2,
          commerciaux: 8
        },
        {
          id: '3',
          nom: 'Bernard',
          prenom: 'Sophie',
          performance: 76,
          objectifsAtteints: 72,
          contratsSignes: 42,
          equipes: 4,
          commerciaux: 16
        }
      ]);

      setPerformanceEquipes([
        {
          id: '1',
          nom: 'Équipe Nord',
          manager: 'Marie Dubois',
          performance: 88,
          objectifsAtteints: 82,
          contratsSignes: 12,
          commerciaux: 4
        },
        {
          id: '2',
          nom: 'Équipe Sud',
          manager: 'Marie Dubois',
          performance: 92,
          objectifsAtteints: 89,
          contratsSignes: 15,
          commerciaux: 5
        },
        {
          id: '3',
          nom: 'Équipe Est',
          manager: 'Jean Martin',
          performance: 76,
          objectifsAtteints: 71,
          contratsSignes: 8,
          commerciaux: 3
        }
      ]);

      setLoading(false);
    };

    loadStatistiques();
  }, [selectedPeriod]);

  const getPerformanceColor = (performance: number) => {
    if (performance >= 90) return 'text-green-600 bg-green-50';
    if (performance >= 75) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const periods = [
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'quarter', label: 'Ce trimestre' },
    { value: 'year', label: 'Cette année' }
  ];

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={4} />;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Statistiques Globales</h1>
          <p className="text-slate-600 mt-1">
            Vue d'ensemble des performances de votre organisation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {periods.map((period) => (
              <Button
                key={period.value}
                variant={selectedPeriod === period.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(period.value)}
                className={selectedPeriod === period.value ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                {period.label}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs Principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Managers" 
          value={statistiques?.totalManagers || 0} 
          Icon={UserCheck} 
          color="text-orange-500" 
        />
        <StatCard 
          title="Équipes" 
          value={statistiques?.totalEquipes || 0} 
          Icon={Users} 
          color="text-blue-500" 
        />
        <StatCard 
          title="Commerciaux" 
          value={statistiques?.totalCommerciaux || 0} 
          Icon={Building2} 
          color="text-green-500" 
        />
        <StatCard 
          title="Performance Globale" 
          value={statistiques?.performanceGlobale || 0} 
          Icon={TrendingUp} 
          color="text-purple-500" 
          suffix="%" 
        />
      </div>

      {/* Performance et Objectifs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-600" />
              Objectifs et Résultats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {statistiques?.objectifsAtteints || 0}%
                </div>
                <div className="text-sm text-slate-600">Objectifs Atteints</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {statistiques?.contratsSignes || 0}
                </div>
                <div className="text-sm text-slate-600">Contrats Signés</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {statistiques?.tauxConversion || 0}%
                </div>
                <div className="text-sm text-slate-600">Taux de Conversion</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {statistiques?.totalImmeubles || 0}
                </div>
                <div className="text-sm text-slate-600">Immeubles Gérés</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              Répartition par Manager
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {performanceManagers.map((manager) => (
                <motion.div
                  key={manager.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {manager.prenom} {manager.nom}
                    </p>
                    <p className="text-sm text-slate-600">
                      {manager.equipes} équipes • {manager.commerciaux} commerciaux
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPerformanceColor(manager.performance)}>
                      {manager.performance}%
                    </Badge>
                    <span className="text-sm text-slate-600">
                      {manager.contratsSignes} contrats
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance par Équipe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-600" />
            Performance par Équipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Équipe</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Manager</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Commerciaux</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Performance</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Objectifs</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Contrats</th>
                </tr>
              </thead>
              <tbody>
                {performanceEquipes.map((equipe) => (
                  <motion.tr
                    key={equipe.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-4 font-medium text-slate-900">{equipe.nom}</td>
                    <td className="py-3 px-4 text-slate-600">{equipe.manager}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{equipe.commerciaux}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={getPerformanceColor(equipe.performance)}>
                        {equipe.performance}%
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={getPerformanceColor(equipe.objectifsAtteints)}>
                        {equipe.objectifsAtteints}%
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">{equipe.contratsSignes}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatistiquesPage;

