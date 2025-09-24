import { useState, useEffect, useMemo, useCallback } from "react";
import { Users, UserCheck, TrendingUp, Target } from "lucide-react";

import { createColumns } from "./commerciaux-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import StatCard from "@/components/ui-admin/StatCard";

import { directeurSpaceService } from "@/services/directeur-space.service";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";

import type { Commercial, EnrichedCommercial } from "@/types/types";

const CommerciauxPage = () => {
  const [data, setData] = useState<EnrichedCommercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calcul des statistiques globales
  const globalStats = useMemo(() => {
    if (!data.length) return {
      totalCommerciaux: 0,
      commerciauxAssignes: 0,
      tauxAssignation: 0,
      moyenneContrats: 0
    };

    const totalCommerciaux = data.length;
    const commerciauxAssignes = data.filter(c => c.managerId && c.equipeId).length;
    const tauxAssignation = totalCommerciaux > 0 ? Math.round((commerciauxAssignes / totalCommerciaux) * 100) : 0;
    const totalContrats = data.reduce((sum, c) => sum + (c.totalContratsSignes || 0), 0);
    const moyenneContrats = totalCommerciaux > 0 ? Math.round(totalContrats / totalCommerciaux) : 0;

    return {
      totalCommerciaux,
      commerciauxAssignes,
      tauxAssignation,
      moyenneContrats
    };
  }, [data]);

  /* ---------------------- Fetch Data ---------------------- */
  useEffect(() => {
    const abort = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const commerciauxFromApi = await directeurSpaceService.getCommerciaux();

        if (abort.signal.aborted) return;

        // Maps are not needed since we use the nested structure from DirecteurCommercial

        // Enrichir + calculer totalContratsSignes une seule fois
         const enriched: EnrichedCommercial[] = commerciauxFromApi.map((comm: any) => {
          const totalContratsSignes = comm.historiques.reduce(
            (sum: number, h: any) => sum + h.nbContratsSignes,
            0
          );
          return {
            ...comm,
            telephone: comm.telephone ?? null,
            manager: comm.equipe?.manager ? `${comm.equipe.manager.prenom} ${comm.equipe.manager.nom}` : "Non assigné",
            managerId: comm.equipe?.manager?.id || undefined,
            equipe: comm.equipe?.nom || "Non assignée",
            equipeId: comm.equipe?.id || undefined,
            isAssigned: Boolean(comm.equipe?.manager?.id && comm.equipe?.id),
            classement: 0,
            totalContratsSignes,
          };
        });

        // Tri + classement
        enriched.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);
        const ranked = enriched.map((c, i) => ({ ...c, classement: i + 1 }));

        setData(ranked);
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error("Erreur lors de la récupération des données:", err);
          setError("Impossible de charger les commerciaux.");
        }
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    };

    fetchData();
    return () => abort.abort();
  }, []);

  // Le directeur ne peut que consulter
  const handleEditOpen = () => {};
  const handleViewDetails = useCallback((commercial: Commercial) => {
    // Navigation vers la page de détails du commercial
    window.location.href = `/directeur/commerciaux/${commercial.id}`;
  }, []);

  const columns = useMemo(
    () => createColumns(false, handleEditOpen as any, handleViewDetails as any, () => {}) as any,
    [handleViewDetails]
  );

  /* ---------------------- UI ---------------------- */
  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable hasFilters />;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <>
      {/* Section Statistiques Globales */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Vue d'ensemble des Commerciaux</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Commerciaux" 
            value={globalStats.totalCommerciaux} 
            Icon={Users} 
            color="text-blue-500" 
          />
          <StatCard 
            title="Commerciaux Assignés" 
            value={globalStats.commerciauxAssignes} 
            Icon={UserCheck} 
            color="text-green-500" 
          />
          <StatCard 
            title="Taux d'Assignation" 
            value={globalStats.tauxAssignation} 
            Icon={TrendingUp} 
            suffix="%" 
            color="text-purple-500" 
          />
          <StatCard 
            title="Moyenne Contrats" 
            value={globalStats.moyenneContrats} 
            Icon={Target} 
            color="text-orange-500" 
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        title="Mes Commerciaux"
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom de commercial..."
        isDeleteMode={false}
        onToggleDeleteMode={() => {}}
        rowSelection={{}}
        setRowSelection={() => {}}
        onConfirmDelete={() => {}}
      />
    </>
  );
};

export default CommerciauxPage;

