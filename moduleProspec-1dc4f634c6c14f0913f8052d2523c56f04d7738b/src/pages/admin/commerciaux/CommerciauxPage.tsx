import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { RowSelectionState } from "@tanstack/react-table";

import { createColumns } from "./commerciaux-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { Input } from "@/components/ui-admin/input";
import { Label } from "@/components/ui-admin/label";
import { Modal } from "@/components/ui-admin/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-admin/select";

import { commercialService } from "@/services/commercial.service";
import { equipeService } from "@/services/equipe.service";
import { managerService } from "@/services/manager.service";
import { adminService } from "@/services/admin.service";

import type { Commercial, Manager, EnrichedCommercial } from "@/types/types";

type TeamLite = { id: string; nom: string };

const initialFormState = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  equipeId: "",
  managerId: "",
};

const CommerciauxPage = () => {
  const [data, setData] = useState<EnrichedCommercial[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [itemsToDelete, setItemsToDelete] = useState<Commercial[]>([]);

  const [teamsOfSelectedManager, setTeamsOfSelectedManager] = useState<TeamLite[]>([]);
  const [teamsOfSelectedManagerInEdit, setTeamsOfSelectedManagerInEdit] = useState<TeamLite[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [newCommercialData, setNewCommercialData] = useState(initialFormState);
  const [editingCommercial, setEditingCommercial] = useState<Commercial | null>(null);

  /* ---------------------- Fetch Data ---------------------- */
  useEffect(() => {
    const abort = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [commerciauxFromApi, equipesFromApi, managersFromApi] = await Promise.all([
          commercialService.getCommerciaux(),
          equipeService.getEquipes(),
          managerService.getManagers(),
        ]);

        if (abort.signal.aborted) return;

        setManagers(managersFromApi || []);

        const equipesMap = new Map(equipesFromApi.map((e) => [e.id, e.nom] as const));
        const managersMap = new Map(
          managersFromApi.map((m) => [m.id, `${m.prenom} ${m.nom}`] as const)
        );

        // Enrichir + calculer totalContratsSignes une seule fois
        const enriched: EnrichedCommercial[] = commerciauxFromApi.map((comm) => {
          const totalContratsSignes = comm.historiques.reduce(
            (sum: number, h: any) => sum + h.nbContratsSignes,
            0
          );
          return {
            ...comm,
            manager: managersMap.get(comm.managerId) || "N/A",
            equipe: comm.equipeId
              ? equipesMap.get(comm.equipeId) || "Non assignée"
              : "Non assignée",
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

  /* ---------------------- Columns ---------------------- */
  const columns = useMemo(
    () => createColumns(isDeleteMode, (c) => handleEditOpen(c)),
    [isDeleteMode]
  );

  /* ---------------------- Add Commercial ---------------------- */
  const handleAddInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setNewCommercialData((prev) => ({ ...prev, [id]: value }));
    },
    []
  );

  const handleSelectManagerAdd = useCallback(
    (managerId: string) => {
      setNewCommercialData((prev) => ({ ...prev, managerId, equipeId: "" }));
      const selectedManager = managers.find((m) => m.id === managerId);
      setTeamsOfSelectedManager(selectedManager?.equipes || []);
    },
    [managers]
  );

  const handleAddCommercial = useCallback(async () => {
    const { nom, prenom, email, telephone, managerId, equipeId } = newCommercialData;
    if (!nom || !prenom || !email || !managerId || !equipeId) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    try {
      // Use the admin service which integrates with Keycloak
      const result = await adminService.createCommercial({
        nom,
        prenom,
        email,
        telephone,
        managerId,
        equipeId,
      });
      
      setIsAddModalOpen(false);
      setNewCommercialData(initialFormState);
      setTeamsOfSelectedManager([]);
      
      // Show success message (handle potential email failure)
      if (result?.setupLink) {
        alert(`Commercial créé avec succès, mais l'envoi de l'email a échoué. Lien de configuration: ${result.setupLink}`);
      } else {
        alert(result?.message || `Commercial créé avec succès ! Un email de configuration a été envoyé à ${email}`);
      }
      
      // Reload data
      fetchDataWrapper();
    } catch (err: any) {
      console.error("Erreur lors de l'ajout du commercial:", err);
      
      // Show specific error message
      const errorMessage = err.response?.data?.message || "Erreur lors de la création du commercial";
      alert(errorMessage);
    }
  }, [newCommercialData]);

  const fetchDataWrapper = useCallback(() => {
    // Petite fonction pour relancer la récupération (réutilisation)
    // On pourrait extraire fetchData initial mais ici on refait une requête simple
    (async () => {
      setLoading(true);
      try {
        const [commerciauxFromApi, equipesFromApi, managersFromApi] = await Promise.all([
          commercialService.getCommerciaux(),
          equipeService.getEquipes(),
          managerService.getManagers(),
        ]);

        setManagers(managersFromApi || []);

        const equipesMap = new Map(equipesFromApi.map((e) => [e.id, e.nom] as const));
        const managersMap = new Map(
          managersFromApi.map((m) => [m.id, `${m.prenom} ${m.nom}`] as const)
        );

        const enriched: EnrichedCommercial[] = commerciauxFromApi.map((comm) => {
          const totalContratsSignes = comm.historiques.reduce(
            (sum: number, h: any) => sum + h.nbContratsSignes,
            0
          );
          return {
            ...comm,
            manager: managersMap.get(comm.managerId) || "N/A",
            equipe: comm.equipeId
              ? equipesMap.get(comm.equipeId) || "Non assignée"
              : "Non assignée",
            classement: 0,
            totalContratsSignes,
          };
        });

        enriched.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);
        setData(enriched.map((c, i) => ({ ...c, classement: i + 1 })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------------- Edit Commercial ---------------------- */
  const handleEditOpen = useCallback((commercial: Commercial) => {
    setEditingCommercial(commercial);
    // Charger les équipes du manager courant
    const selectedManager = managers.find((m) => m.id === commercial.managerId);
    setTeamsOfSelectedManagerInEdit(selectedManager?.equipes || []);
    setIsEditModalOpen(true);
  }, [managers]);

  const handleEditInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editingCommercial) return;
      const { name, value } = e.target;
      setEditingCommercial({ ...editingCommercial, [name]: value });
    },
    [editingCommercial]
  );

  const handleSelectManagerEdit = useCallback(  
    (managerId: string) => {
      if (!editingCommercial) return;
      const selectedManager = managers.find((m) => m.id === managerId);
      setTeamsOfSelectedManagerInEdit(selectedManager?.equipes || []);
      setEditingCommercial({ ...editingCommercial, managerId, equipeId: "" });
    },
    [editingCommercial, managers]
  );

  const handleUpdateCommercial = useCallback(async () => {
    if (!editingCommercial) return;
    try {
      const { id, nom, prenom, email, telephone, managerId, equipeId } = editingCommercial;
      await commercialService.updateCommercial(id, {
        nom,
        prenom,
        email,
        managerId,
        equipeId,
        telephone: telephone === null ? undefined : telephone,
      });
      setIsEditModalOpen(false);
      setEditingCommercial(null);
      fetchDataWrapper();
    } catch (err) {
      console.error("Erreur de mise à jour du commercial:", err);
    }
  }, [editingCommercial, fetchDataWrapper]);

  /* ---------------------- Delete ---------------------- */
  const toggleDeleteMode = useCallback(() => {
    setIsDeleteMode((prev) => !prev);
    setRowSelection({});
  }, []);

  const handleConfirmDelete = useCallback((selectedItems: Commercial[]) => {
    setItemsToDelete(selectedItems);
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      // Use admin service which also removes from Keycloak
      await Promise.all(itemsToDelete.map((c) => adminService.deleteCommercial(c.id)));
      setItemsToDelete([]);
      setIsDeleteMode(false);
      setRowSelection({});
      
      alert(`${itemsToDelete.length} commercial(ux) supprimé(s) avec succès de Keycloak et de la base de données.`);
      
      fetchDataWrapper();
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      
      const errorMessage = err.response?.data?.message || "Erreur lors de la suppression";
      alert(errorMessage);
    }
  }, [itemsToDelete, fetchDataWrapper]);

  /* ---------------------- UI ---------------------- */
  if (loading) {
    return <div>Chargement des commerciaux...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        title="Gestion des Commerciaux"
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom de commercial..."
        addEntityButtonText="Ajouter un Commercial"
        onAddEntity={() => setIsAddModalOpen(true)}
        isDeleteMode={isDeleteMode}
        onToggleDeleteMode={toggleDeleteMode}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* Modal suppression */}
      <Modal
        isOpen={itemsToDelete.length > 0}
        onClose={() => setItemsToDelete([])}
        title="Confirmer la suppression"
      >
        <h2 className="text-lg font-semibold">Confirmer la suppression</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Êtes-vous sûr de vouloir supprimer les {itemsToDelete.length} commercial(ux) suivant(s) ?
        </p>
        <ul className="my-4 list-disc list-inside max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-md">
          {itemsToDelete.map((item) => (
            <li key={item.id}>
              {item.prenom} {item.nom}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setItemsToDelete([])}>
              Annuler
            </Button>
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleDelete}>
              Valider
            </Button>
        </div>
      </Modal>

      {/* Modal ajout */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setNewCommercialData(initialFormState);
          setTeamsOfSelectedManager([]);
        }}
        title="Ajouter un nouveau commercial"
      >
        <h2 className="text-lg font-semibold mb-4">Ajouter un nouveau commercial</h2>
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" placeholder="Nom de famille" value={newCommercialData.nom} onChange={handleAddInputChange} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="prenom">Prénom</Label>
            <Input id="prenom" placeholder="Prénom" value={newCommercialData.prenom} onChange={handleAddInputChange} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="adresse@email.com" value={newCommercialData.email} onChange={handleAddInputChange}/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="telephone">Téléphone (optionnel)</Label>
            <Input id="telephone" type="tel" placeholder="0612345678" value={newCommercialData.telephone} onChange={handleAddInputChange}/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="managerId">Manager</Label>
            <Select
              onValueChange={handleSelectManagerAdd}
              value={newCommercialData.managerId}
            >
              <SelectTrigger id="managerId">
                <SelectValue placeholder="Sélectionner un manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.prenom} {manager.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="equipeId">Équipe</Label>
            <Select
              onValueChange={(value) =>
                setNewCommercialData((prev) => ({ ...prev, equipeId: value }))
              }
              value={newCommercialData.equipeId}
              disabled={!newCommercialData.managerId}
            >
              <SelectTrigger id="equipeId">
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                {teamsOfSelectedManager.map((equipe) => (
                  <SelectItem key={equipe.id} value={equipe.id}>
                    {equipe.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setIsAddModalOpen(false);
              setNewCommercialData(initialFormState);
              setTeamsOfSelectedManager([]);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleAddCommercial}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Enregistrer
          </Button>
        </div>
      </Modal>

      {/* Modal édition */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCommercial(null);
          setTeamsOfSelectedManagerInEdit([]);
        }}
        title="Modifier le commercial"
      >
        <h2 className="text-lg font-semibold mb-4">Modifier le commercial</h2>
        {editingCommercial && (
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" name="nom" value={editingCommercial.nom} onChange={handleEditInputChange}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="prenom">Prénom</Label>
              <Input id="prenom" name="prenom" value={editingCommercial.prenom} onChange={handleEditInputChange}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={editingCommercial.email} onChange={handleEditInputChange}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                name="telephone"
                type="tel"
                value={editingCommercial.telephone || ""}
                onChange={handleEditInputChange}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="managerId">Manager</Label>
              <Select
                onValueChange={handleSelectManagerEdit}
                value={editingCommercial.managerId}
              >
                <SelectTrigger id="managerId">
                  <SelectValue placeholder="Sélectionner un manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.prenom} {manager.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="equipeId">Équipe</Label>
              <Select
                onValueChange={(value) =>
                  setEditingCommercial((prev) =>
                    prev ? { ...prev, equipeId: value } : prev
                  )
                }
                value={editingCommercial.equipeId}
                disabled={!editingCommercial.managerId}
              >
                <SelectTrigger id="equipeId">
                  <SelectValue placeholder="Sélectionner une équipe" />
                </SelectTrigger>
                <SelectContent>
                  {teamsOfSelectedManagerInEdit.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingCommercial(null);
              setTeamsOfSelectedManagerInEdit([]);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleUpdateCommercial}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Enregistrer les modifications
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default CommerciauxPage;
