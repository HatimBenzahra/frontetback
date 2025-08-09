// frontend-shadcn/src/pages/admin/Managers/ManagersPage.tsx

import React, { useState, useEffect, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
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
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";

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
      toast.success("Manager mis à jour", { description: `${prenom} ${nom}` });
    } catch (error) {
      console.error("Erreur de mise à jour du manager:", error);
      toast.error("Échec de la mise à jour");
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
      // Utilise l'API admin (Keycloak + email comme pour les commerciaux)
      const result = await adminService.createManager(newManagerData);
      setIsAddModalOpen(false);
      setNewManagerData(initialFormState);
      setAddFormErrors({});
      fetchManagers();

      if (result?.setupLink) {
        toast.warning("Manager créé, email non envoyé", {
          description: `Lien de configuration: ${result.setupLink}`,
        });
      } else {
        toast.success("Manager créé", {
          description: result?.message || `${newManagerData.prenom} ${newManagerData.nom}`,
        });
      }
    } catch (err: any) {
      console.error("Erreur lors de l'ajout du manager:", err);
      const errorMessage = err?.response?.data?.message || "Échec de la création du manager";
      toast.error("Échec de la création", { description: errorMessage });
    }
  };

  // --- LOGIQUE DE SUPPRESSION ---
  const handleDelete = async () => {
    try {
      // Bloquer la suppression si le manager possède encore des équipes
      const blocked = managersToDelete.filter(m => (m.equipes?.length ?? 0) > 0);
      const deletable = managersToDelete.filter(m => (m.equipes?.length ?? 0) === 0);

      if (blocked.length > 0) {
        toast.error("Suppression impossible", {
          description: (
            <div>
              <div>Certains managers ont encore des équipes&nbsp;:</div>
              <ul className="mt-1 list-disc list-inside">
                {blocked.map(b => (
                  <li key={b.id}>{b.prenom} {b.nom} ({b.equipes.length} équipe{b.equipes.length>1?'s':''})</li>
                ))}
              </ul>
            </div>
          )
        });
      }

      if (deletable.length === 0) return;

      // Utilise l'API admin pour gérer suppression côté Keycloak + BDD
      await Promise.all(deletable.map(m => adminService.deleteManager(m.id)));
      setManagersToDelete([]);
      setIsDeleteMode(false);
      setRowSelection({});
      // Feedback utilisateur similaire aux commerciaux
      toast.success("Suppression réussie", { description: `${deletable.length} manager(s) supprimé(s).` });
      fetchManagers();
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      const errorMessage = err?.response?.data?.message || "Erreur lors de la suppression du manager";
      toast.error("Échec de la suppression", { description: errorMessage });
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
              {`Vous êtes sur le point de supprimer ${managersToDelete.length} manager(s). Cette action est irréversible.`}
            </p>
          </div>
        </div>
        <div className="mt-4 border rounded-md bg-slate-50">
          <ul className="max-h-44 overflow-y-auto p-3 text-sm">
            {managersToDelete.map(m => (
              <li key={m.id} className="list-disc list-inside">{m.prenom} {m.nom}</li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setManagersToDelete([])}>Annuler</Button>
          <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleDelete}>Supprimer</Button>
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
