import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { immeubleService, type ImmeubleFromApi } from '../../../services/immeuble.service';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { type ImmeubleFormState } from '../../../types/types';
import { buildingStatusMap } from '../../../constants/building-status';
import PageSkeleton from '../../../components/PageSkeleton';
import FilterBar from '../../../components/commercial/FilterBar';
import ImmeubleCard from '../../../components/commercial/ImmeubleCard';
import ImmeubleDetailsModal from '../../../components/commercial/ImmeubleDetailsModal';
import ImmeubleFormModal from '../../../components/commercial/ImmeubleFormModal';

const CommercialImmeublesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [immeubles, setImmeubles] = useState<ImmeubleFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedImmeuble, setSelectedImmeuble] = useState<ImmeubleFromApi | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingImmeuble, setEditingImmeuble] = useState<ImmeubleFromApi | null>(null);
  const [formState, setFormState] = useState<ImmeubleFormState>({} as ImmeubleFormState);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [formStep, setFormStep] = useState(1);

  const fetchImmeubles = useCallback(async () => {
    if (!user?.id) {
      setError('Commercial non identifié.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await immeubleService.getImmeublesForCommercial(user.id);
      const sortedData = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setImmeubles(sortedData);
    } catch (err) {
      setError('Impossible de charger les immeubles.');
      toast.error('Impossible de charger les immeubles.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchImmeubles();
  }, [fetchImmeubles]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'nbEtages' || name === 'nbPortesParEtage' ? Number(value) : value)
    }));
  };

  const getProspectingStatus = (immeuble: ImmeubleFromApi) => {
    if (!immeuble.portes || immeuble.portes.length === 0) {
        return { key: 'NON_CONFIGURE', ...buildingStatusMap.NON_CONFIGURE };
    }
    const visitedDoors = immeuble.portes.filter(porte => porte.statut !== 'NON_VISITE').length;
    if (visitedDoors === immeuble.nbPortesTotal) {
        return { key: 'COMPLET', ...buildingStatusMap.COMPLET };
    }
    if (visitedDoors > 0) {
        return {
            key: 'EN_COURS',
            label: `En cours (${visitedDoors}/${immeuble.nbPortesTotal})`,
            className: buildingStatusMap.EN_COURS.className,
            icon: buildingStatusMap.EN_COURS.icon
        };
    }
    return { key: 'NON_COMMENCE', ...buildingStatusMap.NON_COMMENCE };
  };

  const filteredImmeubles = useMemo(() => {
    return immeubles.filter(immeuble => {
        const searchMatch = searchTerm ? 
            immeuble.adresse.toLowerCase().includes(searchTerm.toLowerCase()) ||
            immeuble.ville.toLowerCase().includes(searchTerm.toLowerCase()) ||
            immeuble.codePostal.toLowerCase().includes(searchTerm.toLowerCase()) 
            : true;

        if (!searchMatch) return false;

        if (activeFilter === 'all') return true;
        if (activeFilter === 'hasElevator') return immeuble.hasElevator;
        if (activeFilter === 'noElevator') return !immeuble.hasElevator;
        if (Object.keys(buildingStatusMap).includes(activeFilter)) {
            return getProspectingStatus(immeuble).key === activeFilter;
        }
        if (activeFilter === 'SOLO' || activeFilter === 'DUO') {
            return immeuble.prospectingMode === activeFilter;
        }
        return true;
    });
  }, [immeubles, searchTerm, activeFilter]);

  const handleOpenModal = (immeuble: ImmeubleFromApi | null = null) => {
    setFormStep(1);
    setEditingImmeuble(immeuble);
    if (immeuble) {
      const storedDetails = localStorage.getItem(`building_${immeuble.id}_details`);
      let nbEtages: number | undefined = undefined;
      let nbPortesParEtage: number | undefined = undefined;

      if (storedDetails) {
        const parsedDetails = JSON.parse(storedDetails);
        nbEtages = parsedDetails.nbEtages || nbEtages;
        nbPortesParEtage = parsedDetails.nbPortesParEtage || nbPortesParEtage;
      } else {
        nbEtages = undefined;
        nbPortesParEtage = undefined;
      }

      setFormState({
        adresse: immeuble.adresse, ville: immeuble.ville, codePostal: immeuble.codePostal,
        nbEtages: nbEtages,
        nbPortesParEtage: nbPortesParEtage,
        hasElevator: immeuble.hasElevator,
        digicode: immeuble.digicode || '', latitude: immeuble.latitude || undefined, longitude: immeuble.longitude || undefined,
      });
    } else {
      setFormState({
        adresse: '', ville: '', codePostal: '', nbEtages: undefined, nbPortesParEtage: undefined, hasElevator: false,
        digicode: '', latitude: undefined, longitude: undefined,
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenDetailsModal = (immeuble: ImmeubleFromApi) => {
    setSelectedImmeuble(immeuble);
    setIsDetailsModalOpen(true);
  };

  const handleGoToProspecting = () => {
    if (!selectedImmeuble) return;
    const status = getProspectingStatus(selectedImmeuble);
    setIsDetailsModalOpen(false);
    if (status.key === 'NON_CONFIGURE') {
        navigate(`/commercial/prospecting/setup/${selectedImmeuble.id}`);
    } else {
        navigate(`/commercial/prospecting/doors/${selectedImmeuble.id}`);
    }
  };

  const handleNextStep = () => {
    if (formStep === 1) {
        if (!formState.adresse || !formState.ville || !formState.codePostal) {
            toast.warning('Veuillez remplir tous les champs d\'adresse.');
            return;
        }
    }
    setFormStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setFormStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!editingImmeuble && (!formState.nbEtages || formState.nbEtages <= 0 || !formState.nbPortesParEtage || formState.nbPortesParEtage <= 0)) {
        toast.error("Le nombre d'étages et de portes doit être supérieur à zéro.");
        return;
    }
    setIsSubmitting(true);
    const dataToSubmit = { 
      adresse: formState.adresse,
      ville: formState.ville,
      codePostal: formState.codePostal,
      nbPortesTotal: Number(formState.nbEtages) * Number(formState.nbPortesParEtage),
      hasElevator: formState.hasElevator,
      digicode: formState.digicode,
      latitude: Number(formState.latitude),
      longitude: Number(formState.longitude),
      ...(editingImmeuble ? {} : { nbEtages: Number(formState.nbEtages), nbPortesParEtage: Number(formState.nbPortesParEtage) }),
    };
    try {
      if (editingImmeuble) {
        await immeubleService.updateImmeubleForCommercial(editingImmeuble.id, dataToSubmit, user.id);
        localStorage.setItem(`building_${editingImmeuble.id}_details`, JSON.stringify({ nbEtages: formState.nbEtages, nbPortesParEtage: formState.nbPortesParEtage }));
        toast.success('Immeuble mis à jour avec succès.');
      } else {
        const newImmeuble = await immeubleService.createImmeubleForCommercial(dataToSubmit, user.id);
        localStorage.setItem(`building_${newImmeuble.id}_details`, JSON.stringify({ nbEtages: formState.nbEtages, nbPortesParEtage: formState.nbPortesParEtage }));
        toast.success('Immeuble créé avec succès.');
      }
      setIsModalOpen(false);
      fetchImmeubles();
    } catch (error: any) {
      if (error.response && error.response.status === 404 && error.response.data.message.includes('No zone found')) {
        toast.error('Vous devez avoir une zone assignée pour créer un immeuble. Veuillez contacter votre administrateur.');
      } else {
        toast.error('Une erreur est survenue lors de la sauvegarde.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) {
      toast.error('Commercial non identifié. Impossible de supprimer l\'immeuble.');
      return;
    }
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet immeuble ? Cette action est irréversible.')) {
      try {
        await immeubleService.deleteImmeubleForCommercial(id, user.id);
        toast.success('Immeuble supprimé.');
        fetchImmeubles();
      } catch (error) {
        toast.error('Erreur lors de la suppression.');
      }
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <div className="text-red-500 p-4 text-center bg-red-50 h-screen">{error}</div>;

  const getBuildingDetails = (immeuble: ImmeubleFromApi) => ({
    nbEtages: (immeuble as any).nbEtages ?? '-',
    nbPortesParEtage: (immeuble as any).nbPortesParEtage ?? '-',
  });


  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen">
        <motion.div 
            className="space-y-8 max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <FilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                onAddImmeuble={() => handleOpenModal()}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredImmeubles.map((immeuble, index) => (
                    <ImmeubleCard
                        key={immeuble.id}
                        immeuble={immeuble}
                        index={index}
                        onOpenDetailsModal={handleOpenDetailsModal}
                        onOpenEditModal={handleOpenModal}
                        onDelete={handleDelete}
                        getProspectingStatus={getProspectingStatus}
                        getBuildingDetails={getBuildingDetails}
                    />
                ))}
            </div>
            {filteredImmeubles.length === 0 && !loading && (
                <div className="text-center py-20 col-span-full bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <Search className="mx-auto h-16 w-16 text-slate-400 mb-4" />
                    <p className="text-xl font-semibold text-slate-800">Aucun immeuble trouvé</p>
                    <p className="text-slate-500 mt-2">Essayez de modifier vos filtres ou d'ajouter un nouvel immeuble.</p>
                </div>
            )}

            <ImmeubleFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingImmeuble={editingImmeuble}
                formState={formState}
                onFormChange={handleFormChange}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                formStep={formStep}
                onNextStep={handleNextStep}
                onPrevStep={handlePrevStep}
                setFormState={setFormState}
            />
            
            <ImmeubleDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                selectedImmeuble={selectedImmeuble}
                getProspectingStatus={getProspectingStatus}
                onGoToProspecting={handleGoToProspecting}
            />
        </motion.div>
    </div>
  );
};

export default CommercialImmeublesPage;
