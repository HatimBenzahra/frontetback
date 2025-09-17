import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Briefcase,
  Award,
} from 'lucide-react';

import { statisticsService } from '@/services/statistics.service';
import { directeurSpaceService } from '@/services/directeur-space.service';

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

import type {
  HistoryEntry,
  CommercialStats,
  CommercialDetails,
} from '@/types/types';

/* ----------------------- Colonnes DataTable ----------------------- */
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

/* ----------------------- Utils UI ----------------------- */


const pieColors = ['#22c55e', '#f97316', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

const CommercialDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
          directeurSpaceService.getCommercial(id),
        ]);

        const formattedHistory: HistoryEntry[] = historyData.map((entry: any) => ({
          ...entry,
          // fallback conservé
          immeubleId: entry.immeubleId || entry.id,
        }));

        if (!abort.signal.aborted) {
          setStats(statsData);
          setHistory(formattedHistory);
          setCommercial(commercialData as any);
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

  const pieData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.repartitionStatuts).map(([name, value]) => ({
      name,
      value: value as number,
    }));
  }, [stats]);

  const handleBackClick = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleRowClick = useCallback(
    (row: HistoryEntry) => {
      if (row.immeubleId) {
        navigate(`/directeur/immeubles/${row.immeubleId}`);
      }
    },
    [navigate]
  );

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards hasCharts cardsCount={4} chartsCount={1} />;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!stats || !commercial) {
    return <div>Aucune statistique disponible pour ce commercial.</div>;
  }

  return (
    <div className="space-y-5 p-6 pb-4 bg-gradient-to-br from-white via-orange-50/60 to-orange-100/30">
      {/* Header compact avec gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-orange-700 to-orange-800 rounded-xl p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          {/* Bouton retour */}
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={handleBackClick}
              className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/20 backdrop-blur-sm border border-white/30"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux commerciaux
            </Button>
          </div>

          {/* Informations principales du commercial - Version compacte */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar plus petit */}
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-xl flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm border border-white/30">
                  {stats.commercialInfo.prenom[0]}{stats.commercialInfo.nom[0]}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Award className="h-3 w-3 text-yellow-800" />
                </div>
              </div>

              {/* Informations du commercial */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">
                  {stats.commercialInfo.prenom} {stats.commercialInfo.nom}
                </h1>
                <div className="flex items-center gap-3 text-orange-100 text-sm">
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    <span>Commercial</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4" />
                    <span>Classement N/A</span>
                  </div>
                </div>
                <p className="text-orange-200 mt-1 text-sm">
                  {commercial.equipe?.manager ? `${commercial.equipe.manager.prenom} ${commercial.equipe.manager.nom}` : 'Manager non assigné'} • {commercial.equipe?.nom || 'Équipe non assignée'}
                </p>
              </div>
            </div>

            {/* Métriques de performance - Version horizontale compacte */}
            <div className="flex gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {stats.kpis.contratsSignes || 0}
                  </div>
                  <div className="text-orange-100 text-xs">Contrats</div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {stats.kpis.rdvPris || 0}
                  </div>
                  <div className="text-orange-100 text-xs">RDV</div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {Math.round((stats.kpis.tauxDeConversion || 0) * 100) / 100}%
                  </div>
                  <div className="text-orange-100 text-xs">Taux</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations Personnelles</CardTitle>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Immeubles Visitées" value={stats.kpis.immeublesVisites} Icon={Building} />
        <StatCard title="Portes Visitées" value={stats.kpis.portesVisitees} Icon={DoorOpen} />
        <StatCard title="Contrats Signés" value={stats.kpis.contratsSignes} Icon={Handshake} />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <StatCard
                  title="Taux de Conversion"
                  value={stats.kpis.tauxDeConversion}
                  Icon={Target}
                  suffix="%"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Le taux de conversion représente le rapport entre le nombre de contrats signés et le
                nombre total de portes visitées. Il mesure l'efficacité du commercial à conclure des
                ventes.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              onRowClick={handleRowClick}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CommercialDetailsPage;