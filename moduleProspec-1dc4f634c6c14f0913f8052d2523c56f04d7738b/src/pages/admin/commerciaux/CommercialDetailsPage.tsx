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
type BackOrigin = 'manager' | 'equipe' | null; // Type pour l'origine du bouton de retour

const getBackButtonWrapperClass = (origin: BackOrigin) => {
  if (origin === 'manager') return 'border-2 border-indigo-500 rounded-md px-2 py-0.5 mr-4';
  if (origin === 'equipe') return 'border-2 border-emerald-500 rounded-md px-2 py-0.5 mr-4';
  return 'mr-4';
};

const pieColors = ['#22c55e', '#f97316', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

const CommercialDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commercial, setCommercial] = useState<CommercialDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const backOrigin: BackOrigin = useMemo(() => {
    if (location.state?.fromManager) return 'manager';
    if (location.state?.fromEquipe) return 'equipe';
    return null;
  }, [location.state]);

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
          // fallback conservé
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
        navigate(`/admin/immeubles/${row.immeubleId}`);
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
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center">
        <div className={getBackButtonWrapperClass(backOrigin)}>
          <Button variant="outline" size="icon" onClick={handleBackClick}>
          <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <h1 className="text-2xl font-bold">
          Statistiques de {stats.commercialInfo.prenom} {stats.commercialInfo.nom}
        </h1>
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
                nombre total de portes visitées. Il mesure l’efficacité du commercial à conclure des
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
