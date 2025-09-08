import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AlertTriangle, Users, Building2, Target, TrendingUp } from "lucide-react";
import type { RowSelectionState } from "@tanstack/react-table";

import { createDirecteurColumns } from "./directeurs-table/columns";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui-admin/button";
import { Input } from "@/components/ui-admin/input";
import { Label } from "@/components/ui-admin/label";
import { Modal } from "@/components/ui-admin/Modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-admin/card";
import StatCard from "@/components/ui-admin/StatCard";

import { directeurService, type Directeur } from "@/services/directeur.service";
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";

const initialFormState = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
};

const DirecteursPage = () => {
  const [data, setData] = useState<Directeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [itemsToDelete, setItemsToDelete] = useState<Directeur[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [newDirecteurData, setNewDirecteurData] = useState(initialFormState);
  const [addFormErrors, setAddFormErrors] = useState<{ [k: string]: string }>({});
  const [editingDirecteur, setEditingDirecteur] = useState<Directeur | null>(null);

  // Calcul des statistiques globales
  const globalStats = useMemo(() => {
    if (!data.length) return {
      totalDirecteurs: 0,
      totalManagers: 0,
      totalEquipes: 0,
      totalCommerciaux: 0,
      totalContrats: 0,
      moyenneContrats: 0
    };

    const totalDirecteurs = data.length;
    const totalManagers = data.reduce((sum, d) => sum + (d.nbManagers || 0), 0);
    const totalEquipes = data.reduce((sum, d) => sum + (d.nbEquipes || 0), 0);
    const totalCommerciaux = data.reduce((sum, d) => sum + (d.nbCommerciaux || 0), 0);
    const totalContrats = data.reduce((sum, d) => sum + (d.totalContratsSignes || 0), 0);
    const moyenneContrats = totalDirecteurs > 0 ? Math.round(totalContrats / totalDirecteurs) : 0;

    return {
      totalDirecteurs,
      totalManagers,
      totalEquipes,
      totalCommerciaux,
      totalContrats,
      moyenneContrats
    };
  }, [data]);

  /* ---------------------- Fetch Data ---------------------- */
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const directeursFromApi = await directeurService.getDirecteurs();
      
      // Calculer les statistiques pour chaque directeur
      const enrichedDirecteurs = directeursFromApi.map((directeur) => {
        const nbManagers = directeur.managers?.length || 0;
        const nbEquipes = directeur.managers?.reduce((sum, manager) => sum + (manager.equipes?.length || 0), 0) || 0;
        const nbCommerciaux = directeur.managers?.reduce((sum, manager) => {
          return sum + (manager.equipes?.reduce((equipeSum, equipe) => equipeSum + (equipe.commerciaux?.length || 0), 0) || 0);
        }, 0) || 0;
        
        const totalContratsSignes = directeur.managers?.reduce((sum, manager) => {
          return sum + (manager.equipes?.reduce((equipeSum, equipe) => {
            return equipeSum + (equipe.commerciaux?.reduce((commSum, commercial) => {
              return commSum + (commercial.historiques?.reduce((histSum, hist) => histSum + hist.nbContratsSignes, 0) || 0);
            }, 0) || 0);
          }, 0) || 0);
        }, 0) || 0;

        return {
          ...directeur,
          nbManagers,
          nbEquipes,
          nbCommerciaux,
          totalContratsSignes,
          classement: 0, // Sera calculé après le tri
        };
      });

      // Tri par performance et attribution du classement
      enrichedDirecteurs.sort((a, b) => b.totalContratsSignes - a.totalContratsSignes);
      const rankedDirecteurs = enrichedDirecteurs.map((d, index) => ({
        ...d,
        classement: index + 1,
      }));

      setData(rankedDirecteurs);
    } catch (err) {
      console.error("Erreur lors de la récupération des directeurs:", err);
      setError("Impossible de charger les directeurs.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------- Columns ---------------------- */
  const columns = useMemo(
    () => createDirecteurColumns(isDeleteMode, (d) => handleEditOpen(d)),
    [isDeleteMode]
  );

  /* ---------------------- Add Directeur ---------------------- */
  const validateAddForm = (data: typeof initialFormState) => {
    const errors: { [k: string]: string } = {};
    if (!data.nom.trim()) errors.nom = "Le nom est obligatoire.";
    if (!data.prenom.trim()) errors.prenom = "Le prénom est obligatoire.";
    if (!data.email.trim()) errors.email = "L'email est obligatoire.";
    return errors;
  };

  const handleAddInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setNewDirecteurData((prev) => {
        const next = { ...prev, [id]: value } as typeof initialFormState;
        setAddFormErrors(validateAddForm(next));
        return next;
      });
    },
    []
  );

  const handleAddDirecteur = useCallback(async () => {
    const { nom, prenom, email, telephone } = newDirecteurData;
    const errors = validateAddForm(newDirecteurData);
    setAddFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    
    try {
      // Utilise l'API admin pour intégrer avec Keycloak
      const result = await adminService.createDirecteur({
        nom,
        prenom,
        email,
        telephone,
      });
      
      setIsAddModalOpen(false);
      setNewDirecteurData(initialFormState);
      setAddFormErrors({});
      
      // Afficher message de succès
      if (result?.setupLink) {
        toast.warning("Directeur créé, email non envoyé", {
          description: `Lien de configuration: ${result.setupLink}`,
        });
      } else {
        toast.success("Directeur créé avec succès", {
          description: result?.message || `Un email de configuration a été envoyé à ${email}`,
        });
      }
      
      fetchData();
    } catch (err: any) {
      console.error("Erreur lors de l'ajout du directeur:", err);
      const errorMessage = err.response?.data?.message || "Erreur lors de la création du directeur";
      toast.error("Échec de la création", { description: errorMessage });
    }
  }, [newDirecteurData]);

  /* ---------------------- Edit Directeur ---------------------- */
  const handleEditOpen = useCallback((directeur: Directeur) => {
    setEditingDirecteur(directeur);
    setIsEditModalOpen(true);
  }, []);

  const handleEditInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editingDirecteur) return;
      const { name, value } = e.target;
      setEditingDirecteur({ ...editingDirecteur, [name]: value });
    },
    [editingDirecteur]
  );

  const handleUpdateDirecteur = useCallback(async () => {
    if (!editingDirecteur) return;
    try {
      const { id, nom, prenom, email, telephone } = editingDirecteur;
      await directeurService.updateDirecteur(id, {
        nom,
        prenom,
        email,
        telephone: telephone === null ? undefined : telephone,
      });
      setIsEditModalOpen(false);
      setEditingDirecteur(null);
      fetchData();
      toast.success("Directeur mis à jour", { description: `${prenom} ${nom}` });
    } catch (err) {
      console.error("Erreur de mise à jour du directeur:", err);
      toast.error("Échec de la mise à jour");
    }
  }, [editingDirecteur]);

  /* ---------------------- Delete ---------------------- */
  const toggleDeleteMode = useCallback(() => {
    setIsDeleteMode((prev) => !prev);
    setRowSelection({});
  }, []);

  const handleConfirmDelete = useCallback((selectedItems: Directeur[]) => {
    setItemsToDelete(selectedItems);
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      // Vérifier si les directeurs ont encore des managers
      const blocked = itemsToDelete.filter(d => (d.nbManagers || 0) > 0);
      const deletable = itemsToDelete.filter(d => (d.nbManagers || 0) === 0);

      if (blocked.length > 0) {
        toast.error("Suppression impossible", {
          description: (
            <div>
              <div>Certains directeurs ont encore des managers :</div>
              <ul className="mt-1 list-disc list-inside">
                {blocked.map(b => (
                  <li key={b.id}>{b.prenom} {b.nom} ({b.nbManagers} manager{(b.nbManagers || 0) > 1 ? 's' : ''})</li>
                ))}
              </ul>
            </div>
          )
        });
      }

      if (deletable.length === 0) return;

      // Utilise l'API admin pour gérer la suppression
      await Promise.all(deletable.map((d) => adminService.deleteDirecteur(d.id)));
      setItemsToDelete([]);
      setIsDeleteMode(false);
      setRowSelection({});
      
      toast.success("Suppression réussie", {
        description: `${deletable.length} directeur(s) supprimé(s).`,
      });
      
      fetchData();
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      const errorMessage = err.response?.data?.message || "Erreur lors de la suppression";
      toast.error("Échec de la suppression", { description: errorMessage });
    }
  }, [itemsToDelete]);

  /* ---------------------- UI ---------------------- */
  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable hasFilters />;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <>
      {/* Section Statistiques Globales */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Vue d'ensemble des Directeurs</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Directeurs" 
            value={globalStats.totalDirecteurs} 
            Icon={Users} 
            color="text-blue-500" 
          />
          <StatCard 
            title="Total Managers" 
            value={globalStats.totalManagers} 
            Icon={Building2} 
            color="text-green-500" 
          />
          <StatCard 
            title="Total Commerciaux" 
            value={globalStats.totalCommerciaux} 
            Icon={TrendingUp} 
            color="text-purple-500" 
          />
          <StatCard 
            title="Total Contrats" 
            value={globalStats.totalContrats} 
            Icon={Target} 
            color="text-orange-500" 
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        title="Gestion des Directeurs"
        filterColumnId="nom"
        filterPlaceholder="Filtrer par nom de directeur..."
        addEntityButtonText="Ajouter un Directeur"
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
              {`Vous êtes sur le point de supprimer ${itemsToDelete.length} directeur(s). Cette action est irréversible.`}
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
          setNewDirecteurData(initialFormState);
          setAddFormErrors({});
        }}
        title="Ajouter un nouveau directeur"
        maxWidth="max-w-4xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          Renseignez les informations du directeur. Les champs marqués d'un astérisque sont obligatoires.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identité</CardTitle>
              <CardDescription>Nom et prénom du directeur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nom">Nom <span className="text-red-500">*</span></Label>
                <Input id="nom" placeholder="Nom de famille" value={newDirecteurData.nom} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.nom} aria-describedby="nom-error" />
                {addFormErrors.nom && <p id="nom-error" className="text-xs text-red-600">{addFormErrors.nom}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="prenom">Prénom <span className="text-red-500">*</span></Label>
                <Input id="prenom" placeholder="Prénom" value={newDirecteurData.prenom} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.prenom} aria-describedby="prenom-error" />
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
                <Input id="email" type="email" placeholder="adresse@email.com" value={newDirecteurData.email} onChange={handleAddInputChange} aria-invalid={!!addFormErrors.email} aria-describedby="email-error" />
                {addFormErrors.email && <p id="email-error" className="text-xs text-red-600">{addFormErrors.email}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input id="telephone" type="tel" placeholder="0612345678" value={newDirecteurData.telephone} onChange={handleAddInputChange} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setIsAddModalOpen(false);
              setNewDirecteurData(initialFormState);
              setAddFormErrors({});
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleAddDirecteur}
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={Object.keys(validateAddForm(newDirecteurData)).length > 0}
          >
            Créer le directeur
          </Button>
        </div>
      </Modal>

      {/* Modal édition */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingDirecteur(null);
        }}
        title="Modifier le directeur"
      >
        <h2 className="text-lg font-semibold mb-4">Modifier le directeur</h2>
        {editingDirecteur && (
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" name="nom" value={editingDirecteur.nom} onChange={handleEditInputChange}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="prenom">Prénom</Label>
              <Input id="prenom" name="prenom" value={editingDirecteur.prenom} onChange={handleEditInputChange}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={editingDirecteur.email} onChange={handleEditInputChange}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                name="telephone"
                type="tel"
                value={editingDirecteur.telephone || ""}
                onChange={handleEditInputChange}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingDirecteur(null);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleUpdateDirecteur}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Enregistrer les modifications
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default DirecteursPage;