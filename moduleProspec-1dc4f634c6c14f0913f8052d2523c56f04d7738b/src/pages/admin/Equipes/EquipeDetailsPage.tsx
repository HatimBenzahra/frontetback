// frontend-shadcn/src/pages/admin/Equipes/EquipeDetailsPage.tsx

import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createColumns as createCommerciauxColumns } from "../commerciaux/commerciaux-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { ArrowLeft, Users, CheckCircle, Briefcase, Target, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui-admin/skeleton";
import StatCard from "@/components/ui-admin/StatCard";
import { GenericLineChart } from "@/components/charts/GenericLineChart";
import { equipeService, type EquipeDetailsFromApi } from "@/services/equipe.service";
import { commercialService } from "@/services/commercial.service";
import type { Commercial } from "@/types/types";
import { Modal } from "@/components/ui-admin/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-admin/select";
import { Label } from "@/components/ui-admin/label";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";

const EquipeDetailsPage = () => {
  const { equipeId } = useParams<{ equipeId: string }>();
  const navigate = useNavigate();
  const [equipeDetails, setEquipeDetails] = useState<EquipeDetailsFromApi | null>(null);
  const [allCommerciaux, setAllCommerciaux] = useState<Commercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddCommercialModalOpen, setIsAddCommercialModalOpen] = useState(false);
  const [selectedCommercialId, setSelectedCommercialId] = useState<string | null>(null);

  useEffect(() => {
    if (equipeId) {
      setLoading(true);
      Promise.all([
        equipeService.getEquipeDetails(equipeId),
        commercialService.getCommerciaux(),
      ]).then(([equipeData, commerciauxData]) => {
        setEquipeDetails(equipeData);
        setAllCommerciaux(commerciauxData.map(comm => ({
          ...comm,
          equipe: comm.equipeId ? "" : "", // Placeholder, will be filled by DataTable
          manager: comm.managerId ? "" : "", // Placeholder, will be filled by DataTable
          classement: 0, // Placeholder
        })));
      }).catch(error => {
        console.error("Erreur lors de la récupération des données:", error);
        setEquipeDetails(null); // Reset in case of error
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [equipeId]);

  const commerciauxColumns = useMemo(() => {
    const allCols = createCommerciauxColumns(false, () => {}); // Pas de mode suppression
    // On exclut les colonnes 'manager' et 'equipe' car redondantes ici
    return allCols.filter(col => col.id !== 'manager' && col.id !== 'equipe');
  }, []);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards hasTable hasCharts cardsCount={4} chartsCount={1} />;
  }

  if (!equipeDetails) {
    return <div>Équipe non trouvée ou erreur de chargement.</div>;
  }

  return (
    <div className="space-y-8">
      <Button variant="outline" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour à la liste des équipes
      </Button>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Équipe {equipeDetails.nom}
        </h1>
        <p className="text-muted-foreground">Manager : {equipeDetails.manager}</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Contrats Signés" value={equipeDetails.stats.contratsSignes} Icon={CheckCircle} color="text-emerald-500" />
        <StatCard title="RDV Pris" value={equipeDetails.stats.rdvPris} Icon={Briefcase} color="text-sky-500"/>
        <StatCard title="Performance Moyenne" value={equipeDetails.stats.perfMoyenne} Icon={Target} suffix="%" color="text-amber-500"/>
        <StatCard title="Classement Général" value={Number(equipeDetails.stats.classementGeneral)} Icon={Trophy} prefix="#" color="text-yellow-500"/>
      </div>

      <GenericLineChart
        data={equipeDetails.perfHistory}
        xAxisDataKey="name"
        lines={[{ dataKey: 'perf', stroke: 'hsl(var(--chart-2))', name: 'Performance (%)' }]}
      />

      <DataTable 
        columns={commerciauxColumns as any} 
        data={equipeDetails.commerciaux} 
        title={`Membres de l'équipe (${equipeDetails.commerciaux.length})`}
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom de commercial..."
        addEntityButtonText="Ajouter un commercial"
        onAddEntity={() => setIsAddCommercialModalOpen(true)}
      />

      <Modal isOpen={isAddCommercialModalOpen} onClose={() => setIsAddCommercialModalOpen(false)} title="Ajouter un commercial à l'équipe" maxWidth="max-w-sm">
        <p className="text-sm text-muted-foreground mb-4">Sélectionnez un commercial dans la liste ci-dessous pour l'ajouter à cette équipe.</p>
        <div className="grid gap-2 py-2">
          <div className="space-y-1">
            <Label htmlFor="commercialId">Commercial</Label>
            <Select onValueChange={(value) => setSelectedCommercialId(value)} value={selectedCommercialId || ""}>
              <SelectTrigger id="commercialId" className="w-full"><SelectValue placeholder="Sélectionner un commercial" /></SelectTrigger>
              <SelectContent>
                {allCommerciaux.filter(c => c.equipeId !== equipeId).map((commercial) => (
                  <SelectItem key={commercial.id} value={commercial.id}>{commercial.prenom} {commercial.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => setIsAddCommercialModalOpen(false)}>Annuler</Button>
          <Button onClick={async () => {
            if (selectedCommercialId && equipeId) {
              await commercialService.updateCommercial(selectedCommercialId, { equipeId });
              setIsAddCommercialModalOpen(false);
              // Refresh data
              setLoading(true);
              equipeService.getEquipeDetails(equipeId)
                .then(data => {
                  setEquipeDetails(data);
                })
                .catch(error => {
                  console.error("Erreur lors de la récupération des détails de l'équipe:", error);
                  setEquipeDetails(null); // Reset in case of error
                })
                .finally(() => {
                  setLoading(false);
                });
            }
          }} disabled={!selectedCommercialId} className="bg-green-600 text-white hover:bg-green-700">Ajouter</Button>
        </div>
      </Modal>
    </div>
  )
}

export default EquipeDetailsPage;