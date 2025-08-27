import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { managerService } from '@/services/manager.service';
import type { EquipeFromApi } from '@/services/equipe.service';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui-admin/badge';
import StatCard from '@/components/ui-admin/StatCard';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { 
  Users, 
  Flag, 
  Target, 
  TrendingUp, 
  Award, 
  Briefcase, 
  FileSignature,
  UserCheck,
  Eye
} from 'lucide-react';

interface EnrichedEquipe extends EquipeFromApi {
  nbCommerciaux: number;
  totalContrats: number;
  totalRdv: number;
  tauxConversion: number;
  classement: number;
  manager: string;
}

const EquipesPage = () => {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const [equipes, setEquipes] = useState<EnrichedEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calcul des statistiques globales pour les équipes du manager
  const globalStats = useMemo(() => {
    if (!equipes.length) return {
      totalEquipes: 0,
      totalCommerciaux: 0,
      totalContrats: 0,
      totalRdv: 0,
      moyenneContrats: 0,
      moyenneRdv: 0,
      tauxConversionGlobal: 0
    };

    const totalEquipes = equipes.length;
    const totalCommerciaux = equipes.reduce((sum, e) => sum + e.nbCommerciaux, 0);
    const totalContrats = equipes.reduce((sum, e) => sum + e.totalContrats, 0);
    const totalRdv = equipes.reduce((sum, e) => sum + e.totalRdv, 0);
    const moyenneContrats = totalEquipes > 0 ? Math.round(totalContrats / totalEquipes) : 0;
    const moyenneRdv = totalEquipes > 0 ? Math.round(totalRdv / totalEquipes) : 0;
    const tauxConversionGlobal = totalRdv > 0 ? Math.round((totalContrats / totalRdv) * 100) : 0;

    return {
      totalEquipes,
      totalCommerciaux,
      totalContrats,
      totalRdv,
      moyenneContrats,
      moyenneRdv,
      tauxConversionGlobal
    };
  }, [equipes]);

  useEffect(() => {
    const loadEquipes = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Récupérer les équipes du manager en utilisant la nouvelle route spécifique
        const managerEquipes = await managerService.getManagerEquipes(user.id);

        // Enrichir les données avec les statistiques
        const enriched: EnrichedEquipe[] = managerEquipes.map((equipe: any) => {
          // Calculer les statistiques de l'équipe
          const commerciaux = equipe.commerciaux || [];
          const totalContrats = commerciaux.reduce((sum: number, c: any) => {
            const contrats = c.historiques?.reduce((hSum: number, h: any) => hSum + h.nbContratsSignes, 0) || 0;
            return sum + contrats;
          }, 0);
          
          const totalRdv = commerciaux.reduce((sum: number, c: any) => {
            const rdv = c.historiques?.reduce((hSum: number, h: any) => hSum + h.nbRdvPris, 0) || 0;
            return sum + rdv;
          }, 0);
          
          const tauxConversion = totalRdv > 0 ? Math.round((totalContrats / totalRdv) * 100) : 0;

          return {
            ...equipe,
            nbCommerciaux: commerciaux.length,
            totalContrats,
            totalRdv,
            tauxConversion,
            classement: 0,
            manager: `${(user as any).prenom || user.name} ${(user as any).nom || ''}`
          };
        });

        // Trier par performance et ajouter le classement
        enriched.sort((a, b) => b.totalContrats - a.totalContrats);
        const ranked = enriched.map((e, i) => ({ ...e, classement: i + 1 }));

        setEquipes(ranked);
      } catch (err) {
        console.error('Erreur lors du chargement des équipes:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadEquipes();
  }, [user?.id]);

  // Configuration des breadcrumbs
  useEffect(() => {
    setBreadcrumbs([
      { label: 'Espace Manager', path: '/manager' },
      { label: 'Mes Équipes', path: '/manager/equipes' }
    ]);
  }, [setBreadcrumbs]);

  // Colonnes pour le tableau
  const columns = useMemo(() => [
    {
      accessorKey: "nom",
      header: "Nom de l'équipe",
      cell: ({ row }: any) => <div className="font-medium">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "nbCommerciaux",
      header: "Commerciaux",
      cell: ({ row }: any) => {
        const nb = row.getValue("nbCommerciaux") || 0;
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {nb}
          </Badge>
        );
      },
    },
    {
      accessorKey: "totalContrats",
      header: "Contrats",
      cell: ({ row }: any) => {
        const contrats = row.getValue("totalContrats") || 0;
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {contrats}
          </Badge>
        );
      },
    },
    {
      accessorKey: "totalRdv",
      header: "RDV",
      cell: ({ row }: any) => {
        const rdv = row.getValue("totalRdv") || 0;
        return (
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
            {rdv}
          </Badge>
        );
      },
    },
    {
      accessorKey: "tauxConversion",
      header: "Taux Conv.",
      cell: ({ row }: any) => {
        const taux = row.getValue("tauxConversion") || 0;
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            {taux}%
          </Badge>
        );
      },
    },
    {
      accessorKey: "classement",
      header: "Classement",
      cell: ({ row }: any) => {
        const classement = row.getValue("classement") as number;
        let badgeClass = "";
        if (classement === 1) badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-300";
        else if (classement === 2) badgeClass = "bg-slate-200 text-slate-800 border-slate-300";
        else if (classement === 3) badgeClass = "bg-orange-200 text-orange-800 border-orange-300";
        else badgeClass = "bg-gray-100 text-gray-800 border-gray-300";
        
        return (
          <Badge variant="outline" className={badgeClass}>
            {classement}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => {
        const equipe = row.original;
        return (
          <div className="text-right">
            <Link 
              to={`/manager/equipes/${equipe.id}`} 
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Eye className="h-4 w-4" />
            </Link>
          </div>
        );
      },
    },
  ], []);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable hasFilters />;
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

  return (
    <div className="space-y-8 bg-gradient-to-br from-white via-green-50/60 to-green-100/30 p-4 sm:p-6 rounded-2xl border border-green-100">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center animate-in fade-in duration-500 border-b border-green-100/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-600/90 text-white flex items-center justify-center shadow-lg">
            <Flag className="h-5 w-5"/>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900">Mes Équipes</h2>
            <p className="text-sm text-zinc-600">Gestion de mes équipes commerciales</p>
          </div>
        </div>
      </div>

      {/* Section Statistiques */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-zinc-900">Performance de mes équipes</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 [animation-delay:100ms] duration-500">
          <StatCard 
            title="Total Équipes" 
            value={globalStats.totalEquipes} 
            Icon={Flag} 
            color="text-blue-500" 
          />
          <StatCard 
            title="Total Commerciaux" 
            value={globalStats.totalCommerciaux} 
            Icon={Users} 
            color="text-green-500" 
          />
          <StatCard 
            title="Total Contrats" 
            value={globalStats.totalContrats} 
            Icon={FileSignature} 
            color="text-emerald-500" 
          />
          <StatCard 
            title="Total RDV" 
            value={globalStats.totalRdv} 
            Icon={Briefcase} 
            color="text-sky-500" 
          />
        </div>
      </section>

      {/* Tableau des équipes */}
      <section className="animate-in fade-in-0 [animation-delay:200ms] duration-500">
        <DataTable
          columns={columns}
          data={equipes}
          title="Liste de mes Équipes"
          filterColumnId="nom"
          filterPlaceholder="Filtrer par nom d'équipe..."
          isDeleteMode={false}
          onToggleDeleteMode={() => {}}
          rowSelection={{}}
          setRowSelection={() => {}}
          onConfirmDelete={() => {}}
        />
      </section>
    </div>
  );
};

export default EquipesPage;
