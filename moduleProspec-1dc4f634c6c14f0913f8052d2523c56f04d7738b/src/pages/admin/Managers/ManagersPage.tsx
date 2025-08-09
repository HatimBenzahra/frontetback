// frontend-shadcn/src/pages/admin/Managers/ManagersPage.tsx

import React, { useState, useEffect, useMemo } from "react";
import type { Manager } from "./managers-table/columns";
import { getColumns } from "./managers-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { Input } from "@/components/ui-admin/input";
import { Label } from "@/components/ui-admin/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-admin/card";
import { type RowSelectionState } from "@tanstack/react-table";
import { Modal } from "@/components/ui-admin/Modal";
import { managerService } from "@/services/manager.service";

type ManagerWithEquipes = Manager & { equipes: any[] };

const ManagersPage = () => {
  const [data, setData] = useState<ManagerWithEquipes[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [managersToDelete, setManagersToDelete] = useState<ManagerWithEquipes[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const initialFormState = { nom: '', prenom: '', email: '', telephone: '' };
  const [newManagerData, setNewManagerData] = useState(initialFormState);
  const [addFormErrors, setAddFormErrors] = useState<{ [k: string]: string }>({});
  const [editingManager, setEditingManager] = useState<ManagerWithEquipes | null>(null);

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const managers = await managerService.getManagers() as ManagerWithEquipes[];
      const formattedManagers = managers.map((m) => {
        const nbEquipes = m.equipes.length;
        const totalContratsSignes = m.equipes.reduce((accEquipe: number, equipe: any) => {
          return (
            accEquipe +
            equipe.commerciaux.reduce((accCommercial: number, commercial: any) => {
              return (
                accCommercial +
                commercial.historiques.reduce((accHistory: number, history: any) => {
                  return accHistory + history.nbContratsSignes;
                }, 0)
              );
            }, 0)
          );
        }, 0);

        return {
          ...m,
          telephone: m.telephone || '',
          nbEquipes: nbEquipes,
          totalContratsSignes: totalContratsSignes,
          equipes: m.equipes,
        };
      });

      // Sort managers by totalContratsSignes for ranking
      formattedManagers.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);

      const rankedManagers = formattedManagers.map((m, index) => ({
        ...m,
        classement: index + 1,
      }));

      setData(rankedManagers);
    } catch (error) {
      console.error("Erreur lors de la récupération des managers:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIQUE D'ÉDITION ---
  const handleEditOpen = (manager: ManagerWithEquipes) => {
    setEditingManager(manager);
    setIsEditModalOpen(true);
  };
  
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingManager) return;
    setEditingManager({ ...editingManager, [e.target.id]: e.target.value });
  };
  
  const handleUpdateManager = async () => {
    if (!editingManager) return;
    try {
      const { id, nom, prenom, email, telephone } = editingManager;
      const payload = { nom, prenom, email, telephone: telephone || undefined };
      await managerService.updateManager(id, payload);
      setIsEditModalOpen(false);
      setEditingManager(null);
      fetchManagers();
    } catch (error) {
      console.error("Erreur de mise à jour du manager:", error);
    }
  };

  // --- LOGIQUE D'AJOUT ---
  const validateAddForm = (data: typeof initialFormState) => {
    const errors: { [k: string]: string } = {};
    if (!data.nom.trim()) errors.nom = "Le nom est obligatoire.";
    if (!data.prenom.trim()) errors.prenom = "Le prénom est obligatoire.";
    if (!data.email.trim()) errors.email = "L'email est obligatoire.";
    return errors;
  };

  const handleAddInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewManagerData(prev => {
      const next = { ...prev, [id]: value } as typeof initialFormState;
      setAddFormErrors(validateAddForm(next));
      return next;
    });
  };

  const handleAddManager = async () => {
    const errors = validateAddForm(newManagerData);
    setAddFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await managerService.createManager(newManagerData);
      setIsAddModalOpen(false);
      setNewManagerData(initialFormState);
      setAddFormErrors({});
      fetchManagers();
    } catch (error) {
      console.error("Erreur lors de l'ajout du manager:", error);
    }
  };

  // --- LOGIQUE DE SUPPRESSION ---
  const handleDelete = async () => {
    try {
      await Promise.all(managersToDelete.map(m => managerService.deleteManager(m.id)));
      setManagersToDelete([]);
      setIsDeleteMode(false);
      setRowSelection({});
      fetchManagers();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  };
  
  const toggleDeleteMode = () => {
    setIsDeleteMode(prev => !prev);
    setRowSelection({});
  };

  const handleConfirmDelete = (selectedManagers: ManagerWithEquipes[]) => {
    setManagersToDelete(selectedManagers);
  };
  
  const columns = useMemo(() => getColumns(isDeleteMode, handleEditOpen), [isDeleteMode]);

  if (loading) {
      return <div>Chargement des managers...</div>;
  }

  return (
    <>
      <DataTable 
        columns={columns} 
        data={data} 
        title="Gestion des Managers"
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom de manager..."
        addEntityButtonText="Ajouter un Manager"
        onAddEntity={() => setIsAddModalOpen(true)}
        isDeleteMode={isDeleteMode}
        onToggleDeleteMode={toggleDeleteMode}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
        onConfirmDelete={handleConfirmDelete}
      />

      <Modal
        isOpen={managersToDelete.length > 0}
        onClose={() => setManagersToDelete([])}
        title="Confirmer la suppression"
      >
        <p className="text-sm text-muted-foreground mt-2">Êtes-vous sûr de vouloir supprimer les {managersToDelete.length} manager(s) suivant(s) ?</p>
        <ul className="my-4 list-disc list-inside max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-md">
          {managersToDelete.map(m => <li key={m.id}>{m.prenom} {m.nom}</li>)}
        </ul>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setManagersToDelete([])}>Annuler</Button>
          <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleDelete}>Valider</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddFormErrors({});
        }}
        title="Ajouter un nouveau manager"
        maxWidth="max-w-3xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          Saisissez les informations du manager. Les champs marqués d’un astérisque sont obligatoires.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identité</CardTitle>
              <CardDescription>Nom et prénom du manager.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nom">Nom <span className="text-red-500">*</span></Label>
                <Input id="nom" placeholder="Dupont" value={newManagerData.nom} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.nom} aria-describedby="m-nom-error" />
                {addFormErrors.nom && <p id="m-nom-error" className="text-xs text-red-600">{addFormErrors.nom}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="prenom">Prénom <span className="text-red-500">*</span></Label>
                <Input id="prenom" placeholder="Jean" value={newManagerData.prenom} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.prenom} aria-describedby="m-prenom-error" />
                {addFormErrors.prenom && <p id="m-prenom-error" className="text-xs text-red-600">{addFormErrors.prenom}</p>}
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
                <Input id="email" type="email" placeholder="jean.dupont@example.com" value={newManagerData.email} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.email} aria-describedby="m-email-error" />
                {addFormErrors.email && <p id="m-email-error" className="text-xs text-red-600">{addFormErrors.email}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input id="telephone" type="tel" placeholder="0612345678" value={newManagerData.telephone} onChange={handleAddInputChange} />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Annuler</Button>
          <Button onClick={handleAddManager} className="bg-green-600 text-white hover:bg-green-700" disabled={Object.keys(validateAddForm(newManagerData)).length > 0}>Créer le manager</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modifier le manager"
      >
        {editingManager && (
            <div className="grid gap-4">
                <div className="space-y-1"><Label htmlFor="nom">Nom</Label><Input id="nom" value={editingManager.nom} onChange={handleEditInputChange} /></div>
                <div className="space-y-1"><Label htmlFor="prenom">Prénom</Label><Input id="prenom" value={editingManager.prenom} onChange={handleEditInputChange} /></div>
                <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={editingManager.email} onChange={handleEditInputChange} /></div>
                <div className="space-y-1"><Label htmlFor="telephone">Téléphone</Label><Input id="telephone" type="tel" value={editingManager.telephone || ''} onChange={handleEditInputChange} /></div>
            </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Annuler</Button>
            <Button onClick={handleUpdateManager} className="bg-green-600 text-white hover:bg-green-700">Enregistrer les modifications</Button>
        </div>
      </Modal>
    </>
  )
}

export default ManagersPage;
