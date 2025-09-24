import { useState, useEffect, useMemo } from "react";
import { Users, UserCheck, Target, Building2, Briefcase, Award } from "lucide-react";
import type { Equipe } from "./equipes-table/columns";
import { createEquipesColumns } from "./equipes-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import StatCard from "@/components/ui-admin/StatCard";
import { directeurSpaceService } from "@/services/directeur-space.service";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";

const EquipesPage = () => {
  const [data, setData] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const equipesFromApi = await directeurSpaceService.getEquipes();


      const enrichedEquipes: Equipe[] = equipesFromApi.map((equipe) => {
        const totalContratsSignes = equipe.commerciaux.reduce((acc: number, commercial: any) => {
          return acc + commercial.historiques.reduce((accHist: number, hist: any) => accHist + hist.nbContratsSignes, 0);
        }, 0);

        return {
          id: equipe.id,
          nom: equipe.nom,
          managerId: equipe.manager.id,
          manager: {
            id: equipe.manager.id,
            nom: `${equipe.manager.prenom} ${equipe.manager.nom}`,
            avatarFallback: `${equipe.manager.prenom[0]}${equipe.manager.nom[0]}`,
          },
          nbCommerciaux: equipe.commerciaux.length,
          totalContratsSignes: totalContratsSignes,
          classementGeneral: 0, // Placeholder, will be calculated next
        };
      });

      // Sort by totalContratsSignes to determine ranking
      enrichedEquipes.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);

      // Assign classementGeneral based on sorted order
      const rankedEquipes = enrichedEquipes.map((equipe, index) => ({
        ...equipe,
        classementGeneral: index + 1,
      }));
      
      setData(rankedEquipes);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  // Le directeur ne peut que consulter, pas modifier
  const handleEditOpen = () => {};

  const columns = useMemo(() => createEquipesColumns(false, handleEditOpen), []);

  // Calcul des statistiques globales
  const globalStats = useMemo(() => {
    if (!data.length) return {
      totalEquipes: 0,
      totalCommerciaux: 0,
      totalContrats: 0,
      moyenneCommerciauxParEquipe: 0,
      moyenneContratsParEquipe: 0,
      equipesActives: 0
    };

    const totalEquipes = data.length;
    const totalCommerciaux = data.reduce((sum, e) => sum + (e.nbCommerciaux || 0), 0);
    const totalContrats = data.reduce((sum, e) => sum + (e.totalContratsSignes || 0), 0);
    const moyenneCommerciauxParEquipe = totalEquipes > 0 ? Math.round(totalCommerciaux / totalEquipes) : 0;
    const moyenneContratsParEquipe = totalEquipes > 0 ? Math.round(totalContrats / totalEquipes) : 0;
    const equipesActives = data.filter(e => (e.nbCommerciaux || 0) > 0).length;

    return {
      totalEquipes,
      totalCommerciaux,
      totalContrats,
      moyenneCommerciauxParEquipe,
      moyenneContratsParEquipe,
      equipesActives
    };
  }, [data]);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable hasFilters />;
  }

  return (
    <>
      {/* Section Statistiques Globales */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Vue d'ensemble des Équipes</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard 
            title="Total Équipes" 
            value={globalStats.totalEquipes} 
            Icon={Building2} 
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
            Icon={Briefcase} 
            color="text-purple-500" 
          />
          <StatCard 
            title="Moyenne Commerciaux/Équipe" 
            value={globalStats.moyenneCommerciauxParEquipe} 
            Icon={UserCheck} 
            color="text-orange-500" 
          />
          <StatCard 
            title="Moyenne Contrats/Équipe" 
            value={globalStats.moyenneContratsParEquipe} 
            Icon={Target} 
            color="text-indigo-500" 
          />
          <StatCard 
            title="Équipes Actives" 
            value={globalStats.equipesActives} 
            Icon={Award} 
            color="text-emerald-500" 
          />
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={data} 
        title="Gestion des Équipes" 
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom d'équipe..."
        isDeleteMode={false}
        onToggleDeleteMode={() => {}}
        rowSelection={{}}
        setRowSelection={() => {}}
        onConfirmDelete={() => {}}
      />
    </>
  )
}

export default EquipesPage;