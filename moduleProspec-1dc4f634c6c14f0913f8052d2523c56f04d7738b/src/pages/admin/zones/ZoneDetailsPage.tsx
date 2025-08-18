import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { zoneService, type ZoneDetailsFromApi } from '@/services/zone.service';
import { Button } from '@/components/ui-admin/button';
import { ArrowLeft, MapPin, Building, CheckCircle, Briefcase } from 'lucide-react';
import { Skeleton } from '@/components/ui-admin/skeleton';
import StatCard from '@/components/ui-admin/StatCard';
import { ZoneMap } from './ZoneMap';
import type { Zone as ZoneTableType } from './columns';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

const ZoneDetailsPage = () => {
  const { zoneId } = useParams<{ zoneId: string }>();
  const navigate = useNavigate();
  const [zoneDetails, setZoneDetails] = useState<ZoneDetailsFromApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (zoneId) {
      setLoading(true);
      zoneService.getZoneDetails(zoneId)
        .then(data => {
          setZoneDetails(data);
        })
        .catch(error => {
          console.error('Erreur lors de la récupération des détails de la zone:', error);
          setZoneDetails(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [zoneId]);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards hasCharts cardsCount={3} chartsCount={1} />;
  }

  if (!zoneDetails) {
    return <div>Zone non trouvée ou erreur de chargement.</div>;
  }

  // Prepare data for the ZoneMap component
  const zoneForMap: ZoneTableType = {
    id: zoneDetails.id,
    name: zoneDetails.nom,
    assignedTo: '', // Not needed for this view
    color: zoneDetails.couleur,
    latlng: (typeof zoneDetails.latitude === 'number' && !isNaN(zoneDetails.latitude) && typeof zoneDetails.longitude === 'number' && !isNaN(zoneDetails.longitude)) ? [zoneDetails.latitude, zoneDetails.longitude] : [0, 0],
    radius: zoneDetails.rayonMetres,
    dateCreation: zoneDetails.createdAt,
  };

  const immeublesForMap = zoneDetails.immeubles.map(imm => ({
    id: imm.id,
    adresse: imm.adresse,
    status: imm.status,
    latlng: (typeof imm.latitude === 'number' && !isNaN(imm.latitude) && typeof imm.longitude === 'number' && !isNaN(imm.longitude))
      ? [imm.latitude, imm.longitude] as [number, number]
      : [0, 0] as [number, number],
  }));

  return (
    <div className="h-full flex flex-col space-y-8">
      <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="w-fit">
        <ArrowLeft className="mr-2 h-4 w-2" />
        Retour à la liste des zones
      </Button>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" />
          Zone: {zoneDetails.nom}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Nombre d'immeubles" value={zoneDetails.stats.nbImmeubles} Icon={Building} color="text-blue-500" />
        <StatCard title="Contrats Signés" value={zoneDetails.stats.totalContratsSignes} Icon={CheckCircle} color="text-emerald-500" />
        <StatCard title="RDV Pris" value={zoneDetails.stats.totalRdvPris} Icon={Briefcase} color="text-sky-500" />
      </div>

      <div className="flex-grow flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Carte de la Zone</h2>
        <div className="flex-grow w-full">
          <ZoneMap
            existingZones={[zoneForMap]}
            immeubles={immeublesForMap}
            zoneToFocus={zoneDetails.id}
          />
        </div>
      </div>
    </div>
  );
};

export default ZoneDetailsPage;
