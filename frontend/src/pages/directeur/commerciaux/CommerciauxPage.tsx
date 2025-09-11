import { useEffect, useState, useMemo } from 'react';

import { DataTable } from '@/components/data-table/DataTable';
import { createColumns as createCommerciauxColumns } from './commerciaux-table/columns';
import { directeurSpaceService } from '@/services/directeur-space.service';
import type { DirecteurCommercial } from '@/services/directeur-space.service';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

const CommerciauxPage = () => {
  const [commerciaux, setCommerciaux] = useState<DirecteurCommercial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCommerciaux = async () => {
      setLoading(true);
      try {
        const data = await directeurSpaceService.getCommerciaux();
        setCommerciaux(data);
      } catch (error) {
        console.error('Erreur lors du chargement des commerciaux:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCommerciaux();
  }, []);

  const columns = useMemo(() => createCommerciauxColumns(false, () => {}), []);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Commerciaux</h1>
          <p className="text-muted-foreground">
            Gestion des commerciaux de l'organisation
          </p>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={commerciaux}
        title={`Commerciaux (${commerciaux.length})`}
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom de commercial..."
      />
    </div>
  );
};

export default CommerciauxPage;
