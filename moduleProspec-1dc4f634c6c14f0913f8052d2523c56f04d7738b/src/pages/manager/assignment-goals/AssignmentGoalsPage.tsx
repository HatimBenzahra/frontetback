import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { usePageBreadcrumb } from '@/hooks/usePageBreadcrumb';

// Services
import { managerService } from '@/services/manager.service';

// Components
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import ZoneAssignmentPage from './ZoneAssignmentPage';

// Types
import { Manager } from '@/types/types';


export default function AssignmentGoalsPage() {
  const [zones, setZones] = useState<any[]>([]);
  const [commercials, setCommercials] = useState<any[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  usePageBreadcrumb({
    basePath: '/manager/assignations-objectifs',
    pageTitle: 'Assignations de Zones',
    subPages: [{ label: 'Assignation de Zone' }]
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zonesData, commercialsData, equipesData] = await Promise.all([
          managerService.getManagerZones(),
          managerService.getManagerCommerciaux(),
          managerService.getManagerEquipes(),
        ]);

        setZones(zonesData);
        setCommercials(commercialsData);
        setManagers([]); // Les managers ne sont pas nécessaires dans l'espace manager
        setEquipes(equipesData);
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
      const [zonesData, commercialsData, equipesData] = await Promise.all([
        managerService.getManagerZones(),
        managerService.getManagerCommerciaux(),
        managerService.getManagerEquipes(),
      ]);

      setZones(zonesData);
      setCommercials(commercialsData);
      setManagers([]); // Les managers ne sont pas nécessaires dans l'espace manager
      setEquipes(equipesData);
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
      <ZoneAssignmentPage
        zones={zones}
        commercials={commercials}
        managers={managers}
        equipes={equipes}
        onDataRefresh={handleDataRefresh}
      />
    </div>
  );
}
