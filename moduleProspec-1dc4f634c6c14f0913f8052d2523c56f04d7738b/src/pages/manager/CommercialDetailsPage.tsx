import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import {
  Building,
  DoorOpen,
  Handshake,
  Target,
  ArrowLeft,
  User,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';

import { statisticsService } from '@/services/statistics.service';
import { commercialService } from '@/services/commercial.service';

import StatCard from '@/components/ui-admin/StatCard';
import { GenericPieChart } from '@/components/charts/GenericPieChart';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui-admin/tooltip';
import { DataTable } from '@/components/data-table/DataTable';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';

import type {
  HistoryEntry,
  CommercialStats,
  CommercialDetails,
} from '@/types/types';

const historyColumns: ColumnDef<HistoryEntry>[] = [
  { accessorKey: 'adresse', header: 'Adresse' },
  { accessorKey: 'ville', header: 'Ville' },
  { accessorKey: 'codePostal', header: 'Code Postal' },
  { accessorKey: 'zoneName', header: 'Nom de la Zone' },
  { accessorKey: 'dateProspection', header: 'Date' },
  { accessorKey: 'nbPortesVisitees', header: 'Portes Visitées' },
  { accessorKey: 'totalNbPortesImmeuble', header: 'Total Portes Immeuble' },
  { accessorKey: 'nbContratsSignes', header: 'Contrats Signés' },
  { accessorKey: 'nbRdvPris', header: 'RDV Pris' },
  { accessorKey: 'nbRefus', header: 'Refus' },
  { accessorKey: 'nbAbsents', header: 'Absents' },
  {
    accessorKey: 'tauxCouverture',
    header: 'Taux Couverture (%)',
    cell: ({ getValue }) => `${getValue<number>()}%`,
  },
  { accessorKey: 'commentaire', header: 'Commentaire' },
];

const pieColors = ['#22c55e', '#f97316', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

const CommercialDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumb();

  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commercial, setCommercial] = useState<CommercialDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const abort = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, historyData, commercialData] = await Promise.all([
          statisticsService.getStatsForCommercial(id),
          statisticsService.getCommercialHistory(id),
          commercialService.getCommercialDetails(id),
        ]);

        const formattedHistory: HistoryEntry[] = historyData.map((entry: any) => ({
          ...entry,
          immeubleId: entry.immeubleId || entry.id,
        }));

        if (!abort.signal.aborted) {
          setStats(statsData);
          setHistory(formattedHistory);
          setCommercial(commercialData);
          setError(null);
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          setError('Erreur lors de la récupération des données.');
          console.error(err);
        }
      } finally {
        if (!abort.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => abort.abort();
  }, [id]);

  useEffect(() => {
    if (commercial) {
      setBreadcrumbs([
        { label: 'Espace Manager', path: '/manager' },
        { label: 'Mes Commerciaux', path: '/manager/commerciaux' },
        { label: `${commercial.prenom} ${commercial.nom}`, path: `/manager/commerciaux/${commercial.id}` }
      ]);
    }
  }, [setBreadcrumbs, commercial]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.repartitionStatuts).map(([name, value]) => ({
      name,
      value: value as number,
    }));
  }, [stats]);

  const handleBackClick = useCallback(() => {
    navigate('/manager/commerciaux');
  }, [navigate]);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards hasCharts cardsCount={4} chartsCount={1} />;
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

  if (!stats || !commercial) {
    return <div>Aucune statistique disponible pour ce commercial.</div>;
  }

  return (
    <div className="space-y-8 bg-gradient-to-br from-white via-green-50/60 to-green-100/30 p-4 sm:p-6 rounded-2xl border border-green-100">
      {/* Header avec bouton retour */}
      <div className="flex items-center animate-in fade-in duration-500 border-b border-green-100/70 pb-4">
        <Button variant="outline" size="icon" onClick={handleBackClick} className="mr-4">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-600/90 text-white flex items-center justify-center shadow-lg">
            <User className="h-5 w-5"/>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">
              Détails de {stats.commercialInfo.prenom} {stats.commercialInfo.nom}
            </h1>
            <p className="text-sm text-zinc-600">Statistiques et historique de prospection</p>
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <Card className="animate-in fade-in-0 [animation-delay:100ms] duration-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informations Personnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-gray-500" />
            <span>
              {commercial.prenom} {commercial.nom}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Phone className="h-5 w-5 text-gray-500" />
            <span>{commercial.telephone || 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-gray-500" />
            <span>{commercial.email}</span>
          </div>
          <div className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-gray-500" />
            <span>
              {commercial.equipe
                ? `${commercial.equipe.manager.prenom} ${commercial.equipe.manager.nom}`
                : 'N/A'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques principales */}
      <section className="animate-in fade-in-0 [animation-delay:200ms] duration-500">
        <h3 className="text-lg font-semibold mb-4 text-zinc-900">Statistiques de performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Immeubles Visitées" value={stats.kpis.immeublesVisites} Icon={Building} color="text-blue-500" />
          <StatCard title="Portes Visitées" value={stats.kpis.portesVisitees} Icon={DoorOpen} color="text-green-500" />
          <StatCard title="Contrats Signés" value={stats.kpis.contratsSignes} Icon={Handshake} color="text-emerald-500" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <StatCard
                    title="Taux de Conversion"
                    value={stats.kpis.tauxDeConversion}
                    Icon={Target}
                    suffix="%"
                    color="text-amber-500"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Le taux de conversion représente le rapport entre le nombre de contrats signés et le
                  nombre total de portes visitées.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </section>

      {/* Graphiques et historique */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-0 [animation-delay:300ms] duration-500">
        <Card>
          <CardHeader>
            <CardTitle>Répartition des Statuts</CardTitle>
            <CardDescription>
              Proportion de chaque statut sur l'ensemble des portes prospectées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: '400px' }}>
              <GenericPieChart
                title="Répartition des Statuts"
                data={pieData}
                dataKey="value"
                nameKey="name"
                colors={pieColors}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique de Prospection</CardTitle>
            <CardDescription>
              Détail des visites et performances par immeuble.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable<HistoryEntry, any>
              columns={historyColumns}
              data={history}
              filterColumnId="adresse"
              filterPlaceholder="Filtrer par adresse..."
              title=""
              noCardWrapper
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CommercialDetailsPage;