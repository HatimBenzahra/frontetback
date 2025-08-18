import React, { useState, useEffect, useMemo } from "react";
import type { Equipe } from "./equipes-table/columns";
import { createEquipesColumns } from "./equipes-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { Input } from "@/components/ui-admin/input";
import { Label } from "@/components/ui-admin/label";
import type { RowSelectionState } from "@tanstack/react-table";
import { Modal } from "@/components/ui-admin/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-admin/select";
import { equipeService } from "@/services/equipe.service";
import { managerService } from "@/services/manager.service";
import type { Manager } from '@/types/types';
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";

const EquipesPage = () => {
  const [data, setData] = useState<Equipe[]>([]);
  const [managersList, setManagersList] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [itemsToDelete, setItemsToDelete] = useState<Equipe[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const initialFormState = { nom: '', managerId: '' };
  const [newEquipeData, setNewEquipeData] = useState(initialFormState);
  const [editingEquipe, setEditingEquipe] = useState<Equipe | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [equipesFromApi, managersFromApi] = await Promise.all([
        equipeService.getEquipes(),
        managerService.getManagers(),
      ]);

      setManagersList(managersFromApi);

      const managersMap = new Map(managersFromApi.map(m => [m.id, m]));

      const enrichedEquipes: Equipe[] = equipesFromApi.map((equipe) => {
        const manager = managersMap.get(equipe.managerId);
        const totalContratsSignes = equipe.commerciaux.reduce((acc: number, commercial: any) => {
          return acc + commercial.historiques.reduce((accHist: number, hist: any) => accHist + hist.nbContratsSignes, 0);
        }, 0);

        return {
          id: equipe.id,
          nom: equipe.nom,
          manager: {
            id: manager?.id || '',
            nom: manager ? `${manager.prenom} ${manager.nom}` : "N/A",
            avatarFallback: manager ? `${manager.prenom[0]}${manager.nom[0]}` : "?",
          },
          nbCommerciaux: equipe.commerciaux.length,
          totalContratsSignes: totalContratsSignes,
          classementGeneral: 0, // Placeholder, will be calculated next
        };
      });

      // Sort by totalContratsSignes to determine ranking
      enrichedEquipes.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);

      // Assign classementGeneral based on sorted order
      const rankedEquipes = enrichedEquipes.map((equipe, index) => ({
        ...equipe,
        classementGeneral: index + 1,
      }));
      
      setData(rankedEquipes);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditOpen = (equipe: Equipe) => {
    setEditingEquipe(equipe);
    setIsEditModalOpen(true);
  };
  
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingEquipe) return;
    setEditingEquipe({ ...editingEquipe, nom: e.target.value });
  };
  
  const handleEditSelectChange = (managerId: string) => {
    if (!editingEquipe) return;
    const manager = managersList.find(m => m.id === managerId);
    if (manager) {
        setEditingEquipe({
            ...editingEquipe,
            manager: {
                ...editingEquipe.manager,
                id: manager.id,
                nom: `${manager.prenom} ${manager.nom}`
            }
        });
    }
  };

  const handleUpdateEquipe = async () => {
    if (!editingEquipe) return;
    try {
      const payload = {
        nom: editingEquipe.nom,
        managerId: editingEquipe.manager.id,
      };
      await equipeService.updateEquipe(editingEquipe.id, payload);
      setIsEditModalOpen(false);
      setEditingEquipe(null);
      fetchData();
    } catch(error) {
      console.error("Erreur de mise à jour de l'équipe:", error);
    }
  };

  const handleAddInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewEquipeData(prev => ({ ...prev, nom: e.target.value }));
  };

  const handleAddSelectChange = (managerId: string) => {
    setNewEquipeData(prev => ({ ...prev, managerId }));
  };

  const handleAddEquipe = async () => {
    if (!newEquipeData.nom || !newEquipeData.managerId) {
      alert("Veuillez remplir tous les champs.");
      return;
    }
    try {
      await equipeService.createEquipe(newEquipeData);
      setIsAddModalOpen(false);
      setNewEquipeData(initialFormState);
      fetchData();
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'équipe:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await Promise.all(itemsToDelete.map(e => equipeService.deleteEquipe(e.id)));
      setItemsToDelete([]);
      setIsDeleteMode(false);
      setRowSelection({});
      fetchData();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  };

  const toggleDeleteMode = () => { setIsDeleteMode(prev => !prev); setRowSelection({}); };
  const handleConfirmDelete = (selectedItems: Equipe[]) => { setItemsToDelete(selectedItems); };

  const columns = useMemo(() => createEquipesColumns(isDeleteMode, handleEditOpen), [isDeleteMode]);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable hasFilters />;
  }

  return (
    <>
      <DataTable 
        columns={columns} data={data} title="Gestion des Équipes" filterColumnId="nom"
        filterPlaceholder="Filtrer par nom d'équipe..." addEntityButtonText="Ajouter une Équipe"
        onAddEntity={() => setIsAddModalOpen(true)} isDeleteMode={isDeleteMode} onToggleDeleteMode={toggleDeleteMode}
        rowSelection={rowSelection} setRowSelection={setRowSelection} onConfirmDelete={handleConfirmDelete}
      />

      <Modal isOpen={itemsToDelete.length > 0} onClose={() => setItemsToDelete([])} title="Confirmer la suppression">
        <h2 className="text-lg font-semibold">Confirmer la suppression</h2>
        <p className="text-sm text-muted-foreground mt-2">Êtes-vous sûr de vouloir supprimer les {itemsToDelete.length} équipe(s) suivante(s) ?</p>
        <ul className="my-4 list-disc list-inside max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-md">
          {itemsToDelete.map(item => <li key={item.id}>{item.nom} (Manager: {item.manager.nom})</li>)}
        </ul>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setItemsToDelete([])}>Annuler</Button>
          <Button variant="destructive" onClick={handleDelete}>Valider</Button>
        </div>
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Ajouter une nouvelle équipe">
        <h2 className="text-lg font-semibold mb-4">Ajouter une nouvelle équipe</h2>
        <div className="grid gap-4">
          <div className="space-y-1"><Label htmlFor="nom-equipe">Nom de l'équipe</Label><Input id="nom-equipe" placeholder="Ex: Oméga" value={newEquipeData.nom} onChange={handleAddInputChange} /></div>
          <div className="space-y-1">
            <Label htmlFor="manager-equipe">Manager responsable</Label>
            <Select onValueChange={handleAddSelectChange} value={newEquipeData.managerId}>
              <SelectTrigger id="manager-equipe"><SelectValue placeholder="Sélectionner un manager" /></SelectTrigger>
              <SelectContent>
                {managersList.map(manager => (
                  <SelectItem key={manager.id} value={manager.id}>{manager.prenom} {manager.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Annuler</Button>
          <Button onClick={handleAddEquipe} className="bg-green-600 text-white hover:bg-green-700">Enregistrer</Button>
        </div>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modifier l'équipe">
        <h2 className="text-lg font-semibold mb-4">Modifier l'équipe</h2>
        {editingEquipe && (
          <div className="grid gap-4">
            <div className="space-y-1"><Label htmlFor="nom-equipe-edit">Nom de l'équipe</Label><Input id="nom-equipe-edit" value={editingEquipe.nom} onChange={handleEditInputChange} /></div>
            <div className="space-y-1">
              <Label htmlFor="manager-equipe-edit">Manager responsable</Label>
              <Select onValueChange={handleEditSelectChange} value={editingEquipe.manager.id}>
                <SelectTrigger id="manager-equipe-edit"><SelectValue placeholder="Sélectionner un manager" /></SelectTrigger>
                <SelectContent>
                  {managersList.map(manager => (
                    <SelectItem key={manager.id} value={manager.id}>{manager.prenom} {manager.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Annuler</Button>
          <Button onClick={handleUpdateEquipe} className="bg-green-600 text-white hover:bg-green-700">Enregistrer les modifications</Button>
        </div>
      </Modal>
    </>
  )
}

export default EquipesPage;