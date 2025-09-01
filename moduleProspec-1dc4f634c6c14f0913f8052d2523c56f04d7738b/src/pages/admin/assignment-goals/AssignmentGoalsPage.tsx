import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Target, BarChart3 } from 'lucide-react';
import { usePageBreadcrumb } from '@/hooks/usePageBreadcrumb';

// Services
import { commercialService } from '@/services/commercial.service';
import { managerService } from '@/services/manager.service';
import { equipeService } from '@/services/equipe.service';
import { zoneService } from '@/services/zone.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';

// Components
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import ZoneAssignmentPage from './ZoneAssignmentPage';
import GlobalGoalsPage from './GlobalGoalsPage';

// Types
import { ZoneFromApi } from '@/services/zone.service';
import { CommercialFromAPI } from '@/services/commercial.service';
import { Manager } from '@/types/types';
import { EquipeFromApi } from '@/services/equipe.service';


export default function AssignmentGoalsPage() {
  const [zones, setZones] = useState<ZoneFromApi[]>([]);
  const [commercials, setCommercials] = useState<CommercialFromAPI[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [equipes, setEquipes] = useState<EquipeFromApi[]>([]);
  const [currentGlobalGoal, setCurrentGlobalGoal] = useState<{ goal: number; startDate: string; endDate: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'zone' | 'goal'>('zone');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const breadcrumbSubPages = useMemo(
    () => [{ label: activeTab === 'zone' ? 'Assignation de Zone' : 'Objectifs Globaux' }],
    [activeTab]
  );
  
  usePageBreadcrumb({
    basePath: '/admin/assignations-objectifs',
    pageTitle: 'Assignations & Objectifs',
    subPages: breadcrumbSubPages
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zonesData, commercialsData, managersData, equipesData, globalGoal] = await Promise.all([
          zoneService.getZones(),
          commercialService.getCommerciaux(),
          managerService.getManagers(),
          equipeService.getEquipes(),
          assignmentGoalsService.getCurrentGlobalGoal(),
        ]);

        const zonesWithDetails = await Promise.all(
          zonesData.map(async (zone) => {
            try {
              const zoneDetails = await zoneService.getZoneDetails(zone.id);
              return zoneDetails;
            } catch (error) {
              console.warn(`Impossible de récupérer les détails pour la zone ${zone.id}:`, error);
              return zone;
            }
          })
        );

        setZones(zonesWithDetails);
        setCommercials(commercialsData);
        setManagers(managersData);
        setEquipes(equipesData);
        setCurrentGlobalGoal(globalGoal || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Une erreur est survenue';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDataRefresh = async () => {
    try {
      const [zonesData, commercialsData, managersData, equipesData, globalGoal] = await Promise.all([
        zoneService.getZones(),
        commercialService.getCommerciaux(),
        managerService.getManagers(),
        equipeService.getEquipes(),
        assignmentGoalsService.getCurrentGlobalGoal(),
      ]);

      const zonesWithDetails = await Promise.all(
        zonesData.map(async (zone) => {
          try {
            const zoneDetails = await zoneService.getZoneDetails(zone.id);
            return zoneDetails;
          } catch (error) {
            console.warn(`Impossible de récupérer les détails pour la zone ${zone.id}:`, error);
            return zone;
          }
        })
      );

      setZones(zonesWithDetails);
      setCommercials(commercialsData);
      setManagers(managersData);
      setEquipes(equipesData);
      setCurrentGlobalGoal(globalGoal || null);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 sm:p-6 lg:p-8">
      {/* Onglets pour basculer entre les modes */}
      <div className="flex items-center justify-end mb-8">
        <div className="flex items-center bg-white rounded-lg p-2 shadow-sm border">
          <button
            onClick={() => setActiveTab('zone')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'zone'
                ? 'bg-blue-50 text-blue-700 border-2 border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Target className="h-4 w-4" />
            <span>Assignation de Zone</span>
          </button>
          <button
            onClick={() => setActiveTab('goal')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'goal'
                ? 'bg-blue-50 text-blue-700 border-2 border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Objectifs Globaux</span>
          </button>
        </div>
      </div>

      <div className="transition-all duration-500 ease-in-out">
        {activeTab === 'zone' ? (
          <ZoneAssignmentPage
            zones={zones}
            commercials={commercials}
            managers={managers}
            equipes={equipes}
            onDataRefresh={handleDataRefresh}
          />
        ) : (
          <GlobalGoalsPage
            commercials={commercials}
            zones={zones}
            currentGlobalGoal={currentGlobalGoal}
            onGoalUpdate={setCurrentGlobalGoal}
          />
        )}
      </div>
    </div>
  );
}
