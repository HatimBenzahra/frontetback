import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import type { RowSelectionState } from "@tanstack/react-table";

import { createColumns } from "./commerciaux-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { Input } from "@/components/ui-admin/input";
import { Label } from "@/components/ui-admin/label";
import { Modal } from "@/components/ui-admin/Modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-admin/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-admin/select";

import { commercialService } from "@/services/commercial.service";
import { equipeService } from "@/services/equipe.service";
import { managerService } from "@/services/manager.service";
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";

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
  const [addFormErrors, setAddFormErrors] = useState<{ [k: string]: string }>({});
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
         const enriched: EnrichedCommercial[] = commerciauxFromApi.map((comm: any) => {
          const totalContratsSignes = comm.historiques.reduce(
            (sum: number, h: any) => sum + h.nbContratsSignes,
            0
          );
          return {
            ...comm,
               manager: comm.managerId ? managersMap.get(comm.managerId) || "N/A" : "Non assigné",
               equipe: comm.equipeId ? (equipesMap.get(comm.equipeId) || "Non assignée") : "Non assignée",
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
    () => createColumns(isDeleteMode, (c) => handleEditOpen(c), undefined, (c) => handleOpenAssignModal(c)),
    [isDeleteMode]
  );

  /* ---------------------- Add Commercial ---------------------- */
  const validateAddForm = (data: typeof initialFormState) => {
    const errors: { [k: string]: string } = {};
    if (!data.nom.trim()) errors.nom = "Le nom est obligatoire.";
    if (!data.prenom.trim()) errors.prenom = "Le prénom est obligatoire.";
    if (!data.email.trim()) errors.email = "L'email est obligatoire.";
    if (!data.managerId) errors.managerId = "Veuillez sélectionner un manager.";
    if (!data.equipeId) errors.equipeId = "Veuillez sélectionner une équipe.";
    return errors;
  };

  const handleAddInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setNewCommercialData((prev) => {
        const next = { ...prev, [id]: value } as typeof initialFormState;
        setAddFormErrors(validateAddForm(next));
        return next;
      });
    },
    []
  );

  const handleSelectManagerAdd = useCallback(
    (managerId: string) => {
      setNewCommercialData((prev) => {
        const next = { ...prev, managerId, equipeId: "" } as typeof initialFormState;
        setAddFormErrors(validateAddForm(next));
        return next;
      });
      const selectedManager = managers.find((m) => m.id === managerId);
      setTeamsOfSelectedManager(selectedManager?.equipes || []);
    },
    [managers]
  );

  const handleAddCommercial = useCallback(async () => {
    const { nom, prenom, email, telephone, managerId, equipeId } = newCommercialData;
    const errors = validateAddForm(newCommercialData);
    setAddFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
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
      setAddFormErrors({});
      
      // Show success message (handle potential email failure)
      if (result?.setupLink) {
        toast.warning("Commercial créé, email non envoyé", {
          description: `Lien de configuration: ${result.setupLink}`,
        });
      } else {
        toast.success("Commercial créé avec succès", {
          description: result?.message || `Un email de configuration a été envoyé à ${email}`,
        });
      }
      
      // Reload data
      fetchDataWrapper();
    } catch (err: any) {
      console.error("Erreur lors de l'ajout du commercial:", err);
      
      // Show specific error message
      const errorMessage = err.response?.data?.message || "Erreur lors de la création du commercial";
      toast.error("Échec de la création", { description: errorMessage });
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

  /* ---------------------- Assign Modal ---------------------- */
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Commercial | null>(null);
  const [assignManagerId, setAssignManagerId] = useState<string>("");
  const [assignEquipeId, setAssignEquipeId] = useState<string>("");
  const [assignTeams, setAssignTeams] = useState<TeamLite[]>([]);

  const handleOpenAssignModal = (commercial: Commercial) => {
    setAssignTarget(commercial);
    setAssignManagerId("");
    setAssignEquipeId("");
    setAssignTeams([]);
    setIsAssignModalOpen(true);
  };

  const handleSelectAssignManager = (managerId: string) => {
    setAssignManagerId(managerId);
    const selected = managers.find((m) => m.id === managerId);
    setAssignTeams(selected?.equipes || []);
    setAssignEquipeId("");
  };

  const handleConfirmAssign = async () => {
    if (!assignTarget) return;
    try {
      await commercialService.updateCommercial(assignTarget.id, {
        managerId: assignManagerId || undefined,
        equipeId: assignEquipeId || undefined,
      });
      setIsAssignModalOpen(false);
      setAssignTarget(null);
      fetchDataWrapper();
      toast.success("Commercial assigné avec succès");
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'assignation");
    }
  };

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
      
      toast.success("Suppression réussie", {
        description: `${itemsToDelete.length} commercial(ux) supprimé(s).`,
      });
      
      fetchDataWrapper();
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      
      const errorMessage = err.response?.data?.message || "Erreur lors de la suppression";
      toast.error("Échec de la suppression", { description: errorMessage });
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
        maxWidth="max-w-lg"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-red-50 text-red-600 p-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Confirmer la suppression</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {`Vous êtes sur le point de supprimer ${itemsToDelete.length} commercial(ux). Cette action est irréversible.`}
            </p>
          </div>
        </div>
        <div className="mt-4 border rounded-md bg-slate-50">
          <ul className="max-h-44 overflow-y-auto p-3 text-sm">
            {itemsToDelete.map((item) => (
              <li key={item.id} className="list-disc list-inside">
                {item.prenom} {item.nom}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setItemsToDelete([])}>Annuler</Button>
          <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>

      {/* Modal ajout */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setNewCommercialData(initialFormState);
          setTeamsOfSelectedManager([]);
          setAddFormErrors({});
        }}
        title="Ajouter un nouveau commercial"
        maxWidth="max-w-4xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          Renseignez les informations du commercial. Les champs marqués d’un astérisque sont obligatoires.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identité</CardTitle>
              <CardDescription>Nom et prénom du commercial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nom">Nom <span className="text-red-500">*</span></Label>
                <Input id="nom" placeholder="Nom de famille" value={newCommercialData.nom} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.nom} aria-describedby="nom-error" />
                {addFormErrors.nom && <p id="nom-error" className="text-xs text-red-600">{addFormErrors.nom}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="prenom">Prénom <span className="text-red-500">*</span></Label>
                <Input id="prenom" placeholder="Prénom" value={newCommercialData.prenom} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.prenom} aria-describedby="prenom-error" />
                {addFormErrors.prenom && <p id="prenom-error" className="text-xs text-red-600">{addFormErrors.prenom}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
              <CardDescription>Email obligatoire; téléphone optionnel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" placeholder="adresse@email.com" value={newCommercialData.email} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.email} aria-describedby="email-error" />
                {addFormErrors.email && <p id="email-error" className="text-xs text-red-600">{addFormErrors.email}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input id="telephone" type="tel" placeholder="0612345678" value={newCommercialData.telephone} onChange={handleAddInputChange} />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Affectation</CardTitle>
              <CardDescription>Sélectionnez le manager et l’équipe du commercial.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="managerId">Manager <span className="text-red-500">*</span></Label>
                <Select onValueChange={handleSelectManagerAdd} value={newCommercialData.managerId}>
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
                {addFormErrors.managerId && <p className="text-xs text-red-600">{addFormErrors.managerId}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="equipeId">Équipe <span className="text-red-500">*</span></Label>
                <Select
                  onValueChange={(value) =>
                    setNewCommercialData((prev) => {
                      const next = { ...prev, equipeId: value } as typeof initialFormState;
                      setAddFormErrors(validateAddForm(next));
                      return next;
                    })
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
                {addFormErrors.equipeId && <p className="text-xs text-red-600">{addFormErrors.equipeId}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setIsAddModalOpen(false);
              setNewCommercialData(initialFormState);
              setTeamsOfSelectedManager([]);
              setAddFormErrors({});
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleAddCommercial}
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={Object.keys(validateAddForm(newCommercialData)).length > 0}
          >
            Créer le commercial
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

      {/* Modal assignment rapide */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assigner le commercial"
        maxWidth="max-w-xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Sélectionnez un manager et une équipe (optionnel) à associer à ce commercial.
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-manager">Manager</Label>
            <Select onValueChange={handleSelectAssignManager} value={assignManagerId}>
              <SelectTrigger id="assign-manager">
                <SelectValue placeholder="Sélectionner un manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.prenom} {m.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-equipe">Équipe (optionnel)</Label>
            <Select onValueChange={setAssignEquipeId} value={assignEquipeId} disabled={!assignManagerId}>
              <SelectTrigger id="assign-equipe">
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                {assignTeams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Annuler</Button>
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleConfirmAssign} disabled={!assignManagerId}>Assigner</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CommerciauxPage;
