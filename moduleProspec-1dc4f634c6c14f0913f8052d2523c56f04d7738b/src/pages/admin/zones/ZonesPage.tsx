// frontend-shadcn/src/pages/admin/zones/ZonesPage.tsx

import { useState, useEffect, useMemo } from 'react';
import { ZoneMap } from './ZoneMap';
import { Button } from '@/components/ui-admin/button';
import { DataTable } from '@/components/data-table/DataTable';
import { createZoneColumns, type Zone as ZoneTableType } from './columns';
import { Modal } from '@/components/ui-admin/Modal';
import { ZoneCreatorModal } from './ZoneCreatorModal';
import type { RowSelectionState } from '@tanstack/react-table';
import { zoneService } from '@/services/zone.service';
import { commercialService } from '@/services/commercial.service';
import { equipeService } from '@/services/equipe.service';
import { managerService } from '@/services/manager.service';
import { AssignmentType } from '@/types/enums';
import { ViewToggleContainer } from '@/components/ui-admin/ViewToggleContainer';
import type { Commercial, Manager } from '@/types/types';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

const ZonesPage = () => {
  const [view, setView] = useState<'table' | 'map'>('table');
  const [existingZones, setExistingZones] = useState<ZoneTableType[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneTableType | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [itemsToDelete, setItemsToDelete] = useState<ZoneTableType[]>([]);
  const [zoneToFocusId, setZoneToFocusId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zonesData, commercialsData, managersData] = await Promise.all([
        zoneService.getZones(),
        commercialService.getCommerciaux(),
        managerService.getManagers(),
        equipeService.getEquipes(),
      ]);

      const commercialMap = new Map<string, Commercial>();
      commercialsData.forEach(c => commercialMap.set(c.id, c));

      const managerMap = new Map<string, Manager>();
      managersData.forEach(m => managerMap.set(m.id, m));

      const detailedZonesPromises = zonesData.map(async (zone) => {
        const details = await zoneService.getZoneDetails(zone.id);
        let assignedToName = 'Non assignée';

        if (details.typeAssignation === AssignmentType.COMMERCIAL && details.commercialId) {
          const commercial = commercialMap.get(details.commercialId);
          if (commercial) {
            assignedToName = `${commercial.nom} ${commercial.prenom}`;
          }
        } 
        else if (details.typeAssignation === AssignmentType.MANAGER && details.managerId) {
          const manager = managerMap.get(details.managerId);
          if (manager) {
            assignedToName = `Manager: ${manager.nom} ${manager.prenom}`;
          }
        }

        return {
          id: zone.id,
          name: zone.nom,
          assignedTo: assignedToName,
          color: zone.couleur || 'gray',
          latlng: [zone.latitude, zone.longitude] as [number, number],
          radius: zone.rayonMetres,
          dateCreation: zone.createdAt,
          nbImmeubles: details.stats.nbImmeubles,
          totalContratsSignes: details.stats.totalContratsSignes,
          totalRdvPris: details.stats.totalRdvPris,
        };
      });
      const formattedZones = await Promise.all(detailedZonesPromises);
      setExistingZones(formattedZones);
    } catch (error) {
      console.error('Erreur de chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (zone: ZoneTableType) => {
    setEditingZone(zone);
    setIsCreatorOpen(true);
  };

  const handleCloseCreator = () => {
    setIsCreatorOpen(false);
    setEditingZone(null);
  };

  const handleZoneValidated = async (data: {
    id?: string;
    center: { lat: number, lng: number };
    radius: number;
    name: string;
    color: string;
  }) => {
    const payload = {
      nom: data.name,
      latitude: data.center.lat,
      longitude: data.center.lng,
      rayonMetres: data.radius,
      couleur: data.color,
      typeAssignation: AssignmentType.EQUIPE, // Default value
    };

    try {
      if (data.id) {
        await zoneService.updateZone(data.id, payload);
      } else {
        await zoneService.createZone(payload);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la zone:', error);
    }

    handleCloseCreator();
    fetchData();
  };

  const handleConfirmDelete = (selectedRows: ZoneTableType[]) => setItemsToDelete(selectedRows);

  const handleDelete = async () => {
    try {
      await Promise.all(itemsToDelete.map(z => zoneService.deleteZone(z.id)));
      setItemsToDelete([]);
      setIsDeleteMode(false);
      setRowSelection({});
      fetchData();
    } catch (error) {
      console.error('Erreur de suppression:', error);
    }
  };

  const handleRowClick = (zone: ZoneTableType) => {
    setZoneToFocusId(zone.id);
    setView('map');
  };

  const handleViewChange = (newView: 'table' | 'map') => {
    if (newView === 'map') {
      setZoneToFocusId(null); 
    }
    setView(newView);
  };

  const toggleDeleteMode = () => {
    setIsDeleteMode(prev => !prev);
    setRowSelection({});
  };

  const zoneColumns = useMemo(() => createZoneColumns(isDeleteMode, handleEditClick), [isDeleteMode]);

  if (loading) return <AdminPageSkeleton hasHeader hasTable hasFilters />;

  const tableComponent = (
    <DataTable
      noCardWrapper
      columns={zoneColumns}
      data={existingZones}
      title=""
      filterColumnId="name"
      filterPlaceholder="Rechercher une zone par son nom..."
      addEntityButtonText="Ajouter une Zone"
      onAddEntity={() => {
        setEditingZone(null);
        setIsCreatorOpen(true);
      }}
      isDeleteMode={isDeleteMode}
      onToggleDeleteMode={toggleDeleteMode}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      onConfirmDelete={handleConfirmDelete}
      onRowClick={handleRowClick}
    />
  );
  
  const mapComponent = (
    <ZoneMap
      existingZones={existingZones}
      zoneToFocus={zoneToFocusId}
    />
  );

  return (
    <div className="h-full flex flex-col gap-6">
      {isCreatorOpen && (
        <ZoneCreatorModal
          onValidate={handleZoneValidated}
          onClose={handleCloseCreator}
          existingZones={existingZones}
          zoneToEdit={editingZone}
        />
      )}
      <Modal
        isOpen={itemsToDelete.length > 0}
        onClose={() => setItemsToDelete([])}
        title="Confirmer la suppression"
      >
        <p className="text-sm text-muted-foreground mt-2">
          Êtes-vous sûr de vouloir supprimer les {itemsToDelete.length} zone(s) sélectionnée(s)?
        </p>
        <ul className="my-4 list-disc list-inside max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-md">
          {itemsToDelete.map(item => (<li key={item.id}>{item.name}</li>))}
        </ul>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setItemsToDelete([])}>Annuler</Button>
          <Button variant="destructive" onClick={handleDelete}>Valider la suppression</Button>
        </div>
      </Modal>

      <ViewToggleContainer
        title="Gestion des Zones"
        description="Basculez entre la vue tableau et la vue carte interactive pour créer, modifier et visualiser les zones."
        view={view}
        onViewChange={handleViewChange}
        tableComponent={tableComponent}
        mapComponent={mapComponent}
      />
    </div>
  );
};

export default ZonesPage;
