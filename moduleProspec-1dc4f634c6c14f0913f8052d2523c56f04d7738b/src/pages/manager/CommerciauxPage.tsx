import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { managerService } from '@/services/manager.service';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui-admin/badge';
import StatCard from '@/components/ui-admin/StatCard';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { 
  Users, 
  UserCheck, 
  Briefcase, 
  FileSignature,
  Mail,
  Eye
} from 'lucide-react';
import type { Commercial } from '@/types/types';

interface EnrichedCommercial extends Commercial {
  manager: string;
  equipe: string;
  classement: number;
  totalContratsSignes: number;
  totalRdv: number;
  tauxConversion: number;
}

const CommerciauxPage = () => {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const [commerciaux, setCommerciaux] = useState<EnrichedCommercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calcul des statistiques globales pour les commerciaux du manager
  const globalStats = useMemo(() => {
    if (!commerciaux.length) return {
      totalCommerciaux: 0,
      commerciauxActifs: 0,
      totalContrats: 0,
      totalRdv: 0,
      moyenneContrats: 0,
      moyenneRdv: 0,
      tauxConversionGlobal: 0,
      topPerformeur: null as any
    };

    const totalCommerciaux = commerciaux.length;
    const commerciauxActifs = commerciaux.filter(c => c.totalContratsSignes > 0).length;
    const totalContrats = commerciaux.reduce((sum, c) => sum + (c.totalContratsSignes || 0), 0);
    const totalRdv = commerciaux.reduce((sum, c) => sum + (c.totalRdv || 0), 0);
    const moyenneContrats = totalCommerciaux > 0 ? Math.round(totalContrats / totalCommerciaux) : 0;
    const moyenneRdv = totalCommerciaux > 0 ? Math.round(totalRdv / totalCommerciaux) : 0;
    const tauxConversionGlobal = totalRdv > 0 ? Math.round((totalContrats / totalRdv) * 100) : 0;
    const topPerformeur = commerciaux.length > 0 ? commerciaux[0] : null;

    return {
      totalCommerciaux,
      commerciauxActifs,
      totalContrats,
      totalRdv,
      moyenneContrats,
      moyenneRdv,
      tauxConversionGlobal,
      topPerformeur
    };
  }, [commerciaux]);

  useEffect(() => {
    const loadCommerciaux = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Récupérer les commerciaux du manager en utilisant la nouvelle route spécifique
        const managerCommerciaux = await managerService.getManagerCommerciaux(user.id);

        // Enrichir les données avec les statistiques
        const enriched: EnrichedCommercial[] = managerCommerciaux.map((commercial: any) => {
          const totalContratsSignes = commercial.historiques?.reduce(
            (sum: number, h: any) => sum + h.nbContratsSignes, 0
          ) || 0;
          
          const totalRdv = commercial.historiques?.reduce(
            (sum: number, h: any) => sum + h.nbRdvPris, 0
          ) || 0;
          
          const tauxConversion = totalRdv > 0 ? Math.round((totalContratsSignes / totalRdv) * 100) : 0;

          return {
            ...commercial,
            manager: `${(user as any).prenom || user.name} ${(user as any).nom || ''}`,
            equipe: commercial.equipe?.nom || 'Non assignée',
            classement: 0,
            totalContratsSignes,
            totalRdv,
            tauxConversion
          };
        });

        // Trier par performance et ajouter le classement
        enriched.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);
        const ranked = enriched.map((c, i) => ({ ...c, classement: i + 1 }));

        setCommerciaux(ranked);
      } catch (err) {
        console.error('Erreur lors du chargement des commerciaux:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadCommerciaux();
  }, [user?.id]);

  // Configuration des breadcrumbs
  useEffect(() => {
    setBreadcrumbs([
      { label: 'Espace Manager', path: '/manager' },
      { label: 'Mes Commerciaux', path: '/manager/commerciaux' }
    ]);
  }, [setBreadcrumbs]);

  // Colonnes pour le tableau
  const columns = useMemo(() => [
    {
      accessorKey: "nom",
      header: "Nom",
      cell: ({ row }: any) => <div className="font-medium">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "prenom",
      header: "Prénom",
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }: any) => (
        <a href={`mailto:${row.getValue("email")}`} className="flex items-center gap-2 hover:underline">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {row.getValue("email")}
        </a>
      )
    },
    {
      accessorKey: "telephone",
      header: "Téléphone",
      cell: ({ row }: any) => {
        const telephone = row.getValue("telephone");
        if (!telephone) {
          return <span className="text-slate-500">Non renseigné</span>;
        }
        return (
          <a href={`tel:${telephone}`} className="hover:underline">
            {telephone}
          </a>
        );
      }
    },
    {
      accessorKey: "equipe",
      header: "Équipe",
      cell: ({ row }: any) => {
        const equipe = row.getValue("equipe");
        return <span className={equipe === "Non assignée" ? "text-slate-500" : ""}>{equipe}</span>;
      }
    },
    {
      accessorKey: "totalContratsSignes",
      header: "Contrats",
      cell: ({ row }: any) => {
        const contrats = row.getValue("totalContratsSignes") || 0;
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
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
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
        const commercial = row.original;
        return (
          <div className="text-right">
            <Link 
              to={`/manager/commerciaux/${commercial.id}`} 
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
            <Users className="h-5 w-5"/>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900">Mes Commerciaux</h2>
            <p className="text-sm text-zinc-600">Gestion de mon équipe commerciale</p>
          </div>
        </div>
      </div>

      {/* Section Statistiques */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-zinc-900">Performance de mon équipe</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 [animation-delay:100ms] duration-500">
          <StatCard 
            title="Total Commerciaux" 
            value={globalStats.totalCommerciaux} 
            Icon={Users} 
            color="text-blue-500" 
          />
          <StatCard 
            title="Commerciaux Actifs" 
            value={globalStats.commerciauxActifs} 
            Icon={UserCheck} 
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

      {/* Tableau des commerciaux */}
      <section className="animate-in fade-in-0 [animation-delay:200ms] duration-500">
        <DataTable
          columns={columns}
          data={commerciaux}
          title="Liste de mes Commerciaux"
          filterColumnId="nom"
          filterPlaceholder="Filtrer par nom de commercial..."
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

export default CommerciauxPage;
