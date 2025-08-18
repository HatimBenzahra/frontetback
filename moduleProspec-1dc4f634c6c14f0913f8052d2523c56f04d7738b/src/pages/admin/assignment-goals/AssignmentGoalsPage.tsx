import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Services
import { commercialService } from '@/services/commercial.service';
import { zoneService } from '@/services/zone.service';
import { managerService } from '@/services/manager.service';
import { equipeService } from '@/services/equipe.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';

// Types
import { AssignmentType } from '@/types/enums';
import type { Commercial, Manager, Zone } from '@/types/types';
import type { EquipeFromApi } from '@/services/equipe.service';

// Composants enfants
import { ZoneAssignmentCard } from '@/components/page-components/ZoneAssignmentCard';
import { GoalSettingCard } from '@/components/page-components/GoalSettingCard';
import { ZoneMapViewer } from '@/components/page-components/ZoneMapViewer';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

/* -------------------- Helpers -------------------- */
type AssignmentData = {
  commercials: Commercial[];
  managers: Manager[];
  equipes: EquipeFromApi[];
  zones: Zone[];
};

function mapApiZonesToUiZones(zones: any[]): Zone[] {
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.nom,
    assignedTo: '',
    color: zone.couleur,
    latlng: [zone.longitude, zone.latitude] as [number, number],
    radius: zone.rayonMetres,
    dateCreation: zone.createdAt,
    nbImmeubles: 0,
    totalContratsSignes: 0,
    totalRdvPris: 0,
  }));
}

const AssignmentGoalsPage = () => {
  const [data, setData] = useState<AssignmentData>({
    commercials: [],
    managers: [],
    equipes: [],
    zones: [],
  });
  const { commercials, managers, equipes, zones } = data;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [currentGlobalGoal, setCurrentGlobalGoal] = useState<{ goal: number; startDate: string; endDate: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [commercialsData, zonesData, managersData, equipesData, historyData, globalGoal] = await Promise.all([
          commercialService.getCommerciaux(),
          zoneService.getZones(),
          managerService.getManagers(),
          equipeService.getEquipes(),
          assignmentGoalsService.getAssignmentHistory(),
          assignmentGoalsService.getCurrentGlobalGoal(),
        ]);

        setData({
          commercials: commercialsData,
          managers: managersData,
          equipes: equipesData,
          zones: mapApiZonesToUiZones(zonesData),
        });
        setAssignmentHistory(historyData || []);
        setCurrentGlobalGoal(globalGoal || null);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Impossible de charger les données. Veuillez rafraîchir la page.";
        console.error('Failed to fetch initial data:', err);
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAssignZone = async (
    zoneId: string,
    assigneeId: string,
    assigneeType: AssignmentType,
    startDate?: string,
    durationMonths?: number,
  ) => {
    try {
      await assignmentGoalsService.assignZone(
        zoneId, 
        assigneeId, 
        assigneeType, 
        startDate, 
        durationMonths,
        'admin-user', // Pour l'instant, on utilise un ID générique
        'Administrateur' // Pour l'instant, on utilise un nom générique
      );
      toast.success('Zone assignée avec succès!', {
        description: `La zone a été assignée à l'${assigneeType}.`,
      });
      // Refresh history
      const refreshed = await assignmentGoalsService.getAssignmentHistory(selectedZone?.id);
      setAssignmentHistory(refreshed || []);
    } catch (err) {
      console.error('Erreur lors de l\'assignation de la zone:', err);
      toast.error("Erreur lors de l'assignation de la zone.");
    }
  };

  const handleSetGlobalGoal = async (goal: number, startDate?: string, durationMonths?: number) => {
    try {
      const res = await assignmentGoalsService.setGlobalGoal(goal, startDate, durationMonths);
      setCurrentGlobalGoal(res);
      toast.success("Objectif global défini avec succès!", {
        description: `Objectif ${goal} contrats (durée ${durationMonths || 1} mois).`,
      });
    } catch (err) {
      console.error("Erreur lors de la définition de l'objectif global:", err);
      toast.error("Erreur lors de la définition de l'objectif global.");
    }
  };

  const handleSelectZone = async (zoneId: string) => {
    const z = zones.find((z) => z.id === zoneId) ?? null;
    setSelectedZone(z);
    const history = await assignmentGoalsService.getAssignmentHistory(zoneId);
    setAssignmentHistory(history || []);
  };

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={3} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-500">
        <AlertCircle className="h-16 w-16 mb-4" />
        <h2 className="text-2xl font-semibold">Une erreur est survenue</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Assignations et Objectifs
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Gérez les zones de prospection et fixez les objectifs de vos équipes.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne de gauche */}
        <div className="lg:col-span-1 flex flex-col gap-8">
          <ZoneAssignmentCard
            zones={zones}
            commercials={commercials}
            managers={managers}
            equipes={equipes}
            onAssign={handleAssignZone}
            onZoneSelect={handleSelectZone}
          />
          <GoalSettingCard
            onSetGlobalGoal={handleSetGlobalGoal}
            currentGlobalGoal={currentGlobalGoal}
            totalCommerciaux={commercials.length}
          />
        </div>

        <div className="lg:col-span-2 space-y-8">
          <ZoneMapViewer zones={zones} focusedZone={selectedZone} />
          {/* Historique d'assignation */}
          <div className="bg-white rounded-xl border border-[hsl(var(--winvest-blue-moyen))]/20 shadow-lg overflow-hidden">
            <div className="px-4 py-3 bg-[hsl(var(--winvest-blue-moyen))] text-white">
              <h2 className="text-lg font-semibold">Historique des assignations</h2>
              <p className="text-xs opacity-90">Suivi des périodes d'assignation par zone</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-[hsl(var(--winvest-blue-moyen))]/10 text-[hsl(var(--winvest-blue-moyen))]">
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Zone</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Assigné à</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Assigné par</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Début</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Fin</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--winvest-blue-moyen))]/10">
                  {assignmentHistory.map((h) => {
                    const start = new Date(h.startDate);
                    const end = h.endDate ? new Date(h.endDate) : null;
                    const durationDays = end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) : '-';
                    const typeColor =
                      h.assignedToType === 'COMMERCIAL'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : h.assignedToType === 'MANAGER'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    return (
                      <tr key={h.id} className="hover:bg-[hsl(var(--winvest-blue-moyen))]/5 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{h.zoneName || h.zoneId}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{h.assigneeName}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${typeColor} w-fit mt-1`}>
                              {h.assignedToType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{h.assignedByUserName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{start.toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{end ? end.toLocaleDateString('fr-FR') : '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[hsl(var(--winvest-blue-moyen))]/10 text-[hsl(var(--winvest-blue-moyen))] border border-[hsl(var(--winvest-blue-moyen))]/20">
                            {durationDays === '-' ? '-' : `${durationDays} j`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {assignmentHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-500 px-4 py-6">Aucun historique</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentGoalsPage;
