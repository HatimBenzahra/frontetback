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
} from 'lucide-react';

import { directeurSpaceService } from '@/services/directeur-space.service';

import StatCard from '@/components/ui-admin/StatCard';
import { Button } from '@/components/ui-admin/button';
import { DataTable } from '@/components/data-table/DataTable';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

import type {
  HistoryEntry,
  CommercialDetails,
} from '@/types/types';
import type {
  CommercialStats,
} from '@/services/directeur-space.service';

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
        setError(null);

        const [commercialData, statsData, historyData] = await Promise.all([
          directeurSpaceService.getCommercial(id),
          directeurSpaceService.getCommercialStats(id),
          directeurSpaceService.getCommercialHistoriques(id),
        ]);

        setCommercial(commercialData as CommercialDetails);
        setStats(statsData);
        setHistory(historyData);
      } catch (err) {
        console.error('Erreur lors du chargement des données:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      abort.abort();
    };
  }, [id]);

  const handleBackClick = useCallback(() => {
    if (backOrigin === 'manager') {
      navigate('/directeur/managers');
    } else if (backOrigin === 'equipe') {
      navigate('/directeur/equipes');
    } else {
      navigate('/directeur/commerciaux');
    }
  }, [navigate, backOrigin]);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards hasTable hasCharts cardsCount={4} chartsCount={1} />;
  }

  if (error || !commercial) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">{error || 'Commercial non trouvé'}</p>
        <Button onClick={handleBackClick} className="mt-4">
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center">
        <Button variant="outline" onClick={handleBackClick}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        {backOrigin && (
          <span className={getBackButtonWrapperClass(backOrigin)}>
            {backOrigin === 'manager' ? 'Depuis Manager' : 'Depuis Équipe'}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <User className="h-8 w-8 text-primary" />
          {commercial.prenom} {commercial.nom}
        </h1>
        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1">
            <Mail className="h-4 w-4" />
            {commercial.email}
          </div>
          {commercial.telephone && (
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {commercial.telephone}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Contrats Signés"
          value={stats?.totalContracts || 0}
          Icon={Handshake}
          color="text-emerald-500"
        />
        <StatCard
          title="RDV Pris"
          value={stats?.totalRdv || 0}
          Icon={Target}
          color="text-sky-500"
        />
        <StatCard
          title="Portes Visitées"
          value={stats?.totalPortes || 0}
          Icon={DoorOpen}
          color="text-blue-500"
        />
        <StatCard
          title="Taux de Conversion"
          value={stats?.conversionRate || 0}
          Icon={Building}
          suffix="%"
          color="text-purple-500"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Graphiques temporairement désactivés - données non disponibles */}
      </div>

      <DataTable
        columns={historyColumns}
        data={history}
        title={`Historique des prospections (${history.length})`}
        filterColumnId="adresse"
        filterPlaceholder="Filtrer par adresse..."
      />
    </div>
  );
};

export default CommercialDetailsPage;
