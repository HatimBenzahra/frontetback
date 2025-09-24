// frontend-shadcn/src/pages/directeur/managers/ManagersPage.tsx

import { useState, useEffect, useMemo } from "react";
import { Users, UserCheck, TrendingUp, Target, Building2, Briefcase } from "lucide-react";
import type { Manager } from "./managers-table/equipes-columns";
import { getColumns } from "./managers-table/equipes-columns";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { Input } from "@/components/ui-admin/input";
import { Label } from "@/components/ui-admin/label";
import { Modal } from "@/components/ui-admin/Modal";
import StatCard from "@/components/ui-admin/StatCard";
import { directeurSpaceService } from "@/services/directeur-space.service";
import { toast } from "sonner";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";

type ManagerWithEquipes = Manager & { equipes: any[] };

const ManagersPage = () => {
  const [data, setData] = useState<ManagerWithEquipes[]>([]);
  const [loading, setLoading] = useState(true);
  // Le directeur ne peut que consulter, pas supprimer
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ManagerWithEquipes | null>(null);

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const managers = await directeurSpaceService.getManagers() as ManagerWithEquipes[];
      const formattedManagers = managers.map((m) => {
        const nbEquipes = m.equipes?.length || 0;
        const totalContratsSignes = m.equipes?.reduce((accEquipe: number, equipe: any) => {
          return (
            accEquipe +
            equipe.commerciaux?.reduce((accCommercial: number, commercial: any) => {
              return (
                accCommercial +
                commercial.historiques?.reduce((accHistory: number, history: any) => {
                  return accHistory + history.nbContratsSignes;
                }, 0) || 0
              );
            }, 0) || 0
          );
        }, 0) || 0;

        return {
          ...m,
          telephone: m.telephone || '',
          nbEquipes: nbEquipes,
          totalContratsSignes: totalContratsSignes,
          equipes: m.equipes || [],
        };
      });

      // Sort managers by totalContratsSignes for ranking
      formattedManagers.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);

      const rankedManagers = formattedManagers.map((m, index) => ({
        ...m,
        classement: index + 1,
      }));

      setData(rankedManagers);
    } catch (error) {
      console.error("Erreur lors de la récupération des managers:", error);
      toast.error("Erreur lors du chargement des managers");
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIQUE D'ÉDITION ---
  const handleEditOpen = (manager: ManagerWithEquipes) => {
    setEditingManager(manager);
    setIsEditModalOpen(true);
  };
  
  // Le directeur ne peut que consulter, pas modifier

  // Le directeur ne peut que consulter, pas ajouter ou supprimer
  const columns = useMemo(() => getColumns(false, handleEditOpen), []);

  // Calcul des statistiques globales
  const globalStats = useMemo(() => {
    if (!data.length) return {
      totalManagers: 0,
      totalEquipes: 0,
      totalCommerciaux: 0,
      totalContrats: 0,
      moyenneContratsParManager: 0,
      tauxActivation: 0
    };

    const totalManagers = data.length;
    const totalEquipes = data.reduce((sum, m) => sum + (m.equipes?.length || 0), 0);
    const totalCommerciaux = data.reduce((sum, m) => 
      sum + (m.equipes?.reduce((eSum: number, e: any) => eSum + (e.commerciaux?.length || 0), 0) || 0), 0
    );
    const totalContrats = 0; // TODO: Calculer les contrats totaux
    const moyenneContratsParManager = totalManagers > 0 ? Math.round(totalContrats / totalManagers) : 0;
    const managersAvecEquipes = data.filter(m => (m.equipes?.length || 0) > 0).length;
    const tauxActivation = totalManagers > 0 ? Math.round((managersAvecEquipes / totalManagers) * 100) : 0;

    return {
      totalManagers,
      totalEquipes,
      totalCommerciaux,
      totalContrats,
      moyenneContratsParManager,
      tauxActivation
    };
  }, [data]);

  if (loading) {
      return <AdminPageSkeleton hasHeader hasTable hasFilters />;
  }

  return (
    <>
      {/* Section Statistiques Globales */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mes Managers</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard 
            title="Total Managers" 
            value={globalStats.totalManagers} 
            Icon={Users} 
            color="text-blue-500" 
          />
          <StatCard 
            title="Total Équipes" 
            value={globalStats.totalEquipes} 
            Icon={Building2} 
            color="text-green-500" 
          />
          <StatCard 
            title="Total Commerciaux" 
            value={globalStats.totalCommerciaux} 
            Icon={UserCheck} 
            color="text-purple-500" 
          />
          <StatCard 
            title="Total Contrats" 
            value={globalStats.totalContrats} 
            Icon={Briefcase} 
            color="text-orange-500" 
          />
          <StatCard 
            title="Moyenne Contrats/Manager" 
            value={globalStats.moyenneContratsParManager} 
            Icon={Target} 
            color="text-indigo-500" 
          />
          <StatCard 
            title="Taux d'Activation" 
            value={globalStats.tauxActivation} 
            Icon={TrendingUp} 
            suffix="%" 
            color="text-emerald-500" 
          />
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={data} 
        title="Mes Managers"
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom de manager..."
        isDeleteMode={false}
        onToggleDeleteMode={() => {}}
        rowSelection={{}}
        setRowSelection={() => {}}
        onConfirmDelete={() => {}}
      />

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Informations du manager (Lecture seule)"
      >
        {editingManager && (
            <div className="grid gap-4">
                <div className="space-y-1">
                  <Label htmlFor="nom">Nom</Label>
                  <Input id="nom" value={editingManager.nom} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prenom">Prénom</Label>
                  <Input id="prenom" value={editingManager.prenom} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={editingManager.email} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input id="telephone" type="tel" value={editingManager.telephone || ''} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <Label>Nombre d'équipes</Label>
                  <Input value={editingManager.equipes?.length || 0} readOnly className="bg-gray-50" />
                </div>
            </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Fermer</Button>
        </div>
      </Modal>
    </>
  )
}

export default ManagersPage;
