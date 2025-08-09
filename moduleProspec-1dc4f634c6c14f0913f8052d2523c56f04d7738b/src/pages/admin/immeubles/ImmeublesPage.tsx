// frontend-shadcn/src/pages/admin/immeubles/ImmeublesPage.tsx

import { useState, useMemo, useEffect } from "react";
import type { Immeuble } from "./columns";
import { createColumns } from "./columns";
import type { Zone } from '../zones/columns';
import { DataTable } from "@/components/data-table/DataTable";
import { ImmeublesMap } from './ImmeublesMap';
import type { RowSelectionState } from "@tanstack/react-table";
import { ViewToggleContainer } from "@/components/ui-admin/ViewToggleContainer";
import { immeubleService } from "@/services/immeuble.service";
import { zoneService } from "@/services/zone.service";
import { Skeleton } from "@/components/ui-admin/skeleton";

const ImmeublesPage = () => {
    const [view, setView] = useState<'table' | 'map'>('table');
    const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [immeubleToFocusId, setImmeubleToFocusId] = useState<string | null>(null);
    const [zoneToFocusId, setZoneToFocusId] = useState<string | null>(null);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    useEffect(() => {
        fetchData(pageIndex, pageSize);
    }, [pageIndex, pageSize]);

    const fetchData = async (pi = pageIndex, ps = pageSize) => {
        setLoading(true);
        try {
            const [{ items: immeublesFromApi, total }, zonesFromApi] = await Promise.all([
                immeubleService.getImmeublesPaged(pi, ps),
                zoneService.getZones()
            ]);
            setTotalCount(total);
            
            const formattedImmeubles: Immeuble[] = immeublesFromApi.map(imm => {
                let statusText: Immeuble['status'] = 'À visiter';
                switch(imm.status) {
                    case 'VISITE': statusText = 'Visité'; break;
                    case 'RDV_PRIS': statusText = 'RDV Pris'; break;
                    case 'INACCESSIBLE': statusText = 'Inaccessible'; break;
                }
                
                const prospecteurs = Array.isArray(imm.prospectors) ? imm.prospectors : [];
                const portes = Array.isArray(imm.portes) ? imm.portes : [];
                const historiques = Array.isArray(imm.historiques) ? imm.historiques : [];
                
                return {
                    id: imm.id,
                    adresse: imm.adresse,
                    ville: imm.ville,
                    codePostal: imm.codePostal,
                    status: statusText,
                    nbPortes: portes.length,
                    nbPortesProspectees: portes.filter(porte => porte.statut !== 'NON_VISITE').length,
                    prospectingMode: prospecteurs.length > 1 ? "Duo" : "Solo",
                    prospectors: prospecteurs.map((p: { id: string; prenom: string; nom: string; }) => ({
                        id: p.id,
                        nom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
                        avatarFallback: `${p.prenom?.[0] || ''}${p.nom?.[0] || ''}`.toUpperCase()
                    })),
                    dateVisite: historiques.length > 0 ? historiques[0].dateProspection : null,
                    zone: imm.zone?.nom || 'N/A',
                    zoneId: imm.zone?.id || '',
                    latlng: [imm.latitude || 0, imm.longitude || 0],
                };
            });
            
            const formattedZones: Zone[] = zonesFromApi.map(z => ({
                id: z.id, name: z.nom, assignedTo: 'N/A',
                color: z.couleur || 'grey', latlng: [z.latitude || 0, z.longitude || 0],
                radius: z.rayonMetres, dateCreation: z.createdAt,
            }));

            setImmeubles(formattedImmeubles);
            setZones(formattedZones);

        } catch (error) {
            console.error("Erreur de chargement des données:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAndFocusImmeuble = (immeuble: Immeuble) => {
        setImmeubleToFocusId(immeuble.id);
        setZoneToFocusId(null);
        setView('map');
    };

    const handleSelectAndFocusZone = (zoneId: string) => {
        setZoneToFocusId(zoneId);
        setImmeubleToFocusId(null);
        setView('map');
    };
    
    const handleClearFocus = () => {
        setImmeubleToFocusId(null);
        setZoneToFocusId(null);
    };

    const toggleDeleteMode = () => {
        setIsDeleteMode(prev => !prev);
        setRowSelection({});
    };

    const handleConfirmDelete = async (selectedItems: Immeuble[]) => {
        try {
            await Promise.all(selectedItems.map(imm => immeubleService.deleteImmeuble(imm.id)));
            fetchData();
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
        }
        setIsDeleteMode(false);
        setRowSelection({});
    };

    const columns = useMemo(() => createColumns(isDeleteMode, handleSelectAndFocusImmeuble, handleSelectAndFocusZone), [isDeleteMode]);

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    const tableComponent = (
        <DataTable
            noCardWrapper
            columns={columns}
            data={immeubles}
            title=""
            filterColumnId="adresse"
            filterPlaceholder="Filtrer par adresse..."
            addEntityButtonText=""
            onAddEntity={() => {}}
            isDeleteMode={isDeleteMode}
            onToggleDeleteMode={toggleDeleteMode}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onConfirmDelete={handleConfirmDelete}
            onRowClick={handleSelectAndFocusImmeuble}
            manualPagination
            pageCount={Math.max(1, Math.ceil(totalCount / pageSize))}
            pagination={{ pageIndex, pageSize }}
            onPaginationChange={({ pageIndex: idx, pageSize: size }) => {
                if (size !== pageSize) {
                    setPageSize(size);
                    setPageIndex(0);
                } else {
                    setPageIndex(idx);
                }
            }}
        />
    );
    
    const mapComponent = (
        <ImmeublesMap 
            zones={zones} 
            immeubles={immeubles} 
            immeubleToFocusId={immeubleToFocusId}
            zoneToFocusId={zoneToFocusId}
            onFocusClear={handleClearFocus}
        />
    );

    return (
        <ViewToggleContainer
            title="Gestion des Immeubles"
            description="Basculez entre la vue tableau et la vue carte. Cliquez sur une adresse ou une zone pour la localiser."
            view={view}
            onViewChange={setView}
            tableComponent={tableComponent}
            mapComponent={mapComponent}
        />
    );
};

export default ImmeublesPage;
