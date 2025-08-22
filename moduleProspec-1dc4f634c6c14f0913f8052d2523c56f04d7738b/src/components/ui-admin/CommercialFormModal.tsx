import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal, ModalContent, ModalActions } from './Modal';
import { ModernForm } from './ModernForm';
import { Button } from './button';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface CommercialFormData {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  codePostal: string;
  managerId: string;
  equipeId: string;
  statut: 'ACTIF' | 'INACTIF';
}

interface CommercialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CommercialFormData) => Promise<void>;
  managers: Array<{ id: string; nom: string; prenom: string }>;
  equipes: Array<{ id: string; nom: string }>;
  initialData?: Partial<CommercialFormData>;
  isEditing?: boolean;
}

export const CommercialFormModal: React.FC<CommercialFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  managers,
  equipes,
  initialData = {},
  isEditing = false
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CommercialFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formSteps = [
    {
      id: 'identity',
      title: 'Informations personnelles',
      description: 'Saisissez les informations de base du commercial',
      fields: [
        {
          name: 'nom',
          label: 'Nom de famille',
          type: 'text' as const,
          required: true,
          placeholder: 'Ex: Dupont',
          icon: <User className="h-4 w-4" />,
          validation: (value: string) => {
            if (value.length < 2) return 'Le nom doit contenir au moins 2 caractères';
            if (value.length > 50) return 'Le nom ne peut pas dépasser 50 caractères';
            return undefined;
          }
        },
        {
          name: 'prenom',
          label: 'Prénom',
          type: 'text' as const,
          required: true,
          placeholder: 'Ex: Jean',
          icon: <User className="h-4 w-4" />,
          validation: (value: string) => {
            if (value.length < 2) return 'Le prénom doit contenir au moins 2 caractères';
            if (value.length > 50) return 'Le prénom ne peut pas dépasser 50 caractères';
            return undefined;
          }
        },
        {
          name: 'email',
          label: 'Adresse e-mail',
          type: 'email' as const,
          required: true,
          placeholder: 'jean.dupont@exemple.com',
          icon: <Mail className="h-4 w-4" />,
          validation: (value: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) return 'Veuillez saisir une adresse e-mail valide';
            return undefined;
          }
        },
        {
          name: 'telephone',
          label: 'Téléphone',
          type: 'tel' as const,
          required: true,
          placeholder: '06 12 34 56 78',
          icon: <Phone className="h-4 w-4" />,
          validation: (value: string) => {
            const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
            if (!phoneRegex.test(value)) return 'Veuillez saisir un numéro de téléphone valide';
            return undefined;
          }
        }
      ]
    },
    {
      id: 'address',
      title: 'Adresse',
      description: 'Informations de localisation du commercial',
      fields: [
        {
          name: 'adresse',
          label: 'Adresse complète',
          type: 'textarea' as const,
          required: true,
          placeholder: '123 Rue de la Paix',
          icon: <MapPin className="h-4 w-4" />
        },
        {
          name: 'ville',
          label: 'Ville',
          type: 'text' as const,
          required: true,
          placeholder: 'Paris',
          validation: (value: string) => {
            if (value.length < 2) return 'La ville doit contenir au moins 2 caractères';
            return undefined;
          }
        },
        {
          name: 'codePostal',
          label: 'Code postal',
          type: 'text' as const,
          required: true,
          placeholder: '75001',
          validation: (value: string) => {
            if (!/^\d{5}$/.test(value)) return 'Le code postal doit contenir 5 chiffres';
            return undefined;
          }
        }
      ]
    },
    {
      id: 'assignment',
      title: 'Affectation',
      description: 'Définissez l\'organisation et le statut du commercial',
      fields: [
        {
          name: 'managerId',
          label: 'Manager responsable',
          type: 'select' as const,
          required: true,
          placeholder: 'Sélectionner un manager',
          icon: <User className="h-4 w-4" />,
          options: managers.map(manager => ({
            value: manager.id,
            label: `${manager.prenom} ${manager.nom}`
          }))
        },
        {
          name: 'equipeId',
          label: 'Équipe',
          type: 'select' as const,
          required: true,
          placeholder: 'Sélectionner une équipe',
          icon: <Users className="h-4 w-4" />,
          options: equipes.map(equipe => ({
            value: equipe.id,
            label: equipe.nom
          }))
        },
        {
          name: 'statut',
          label: 'Statut',
          type: 'select' as const,
          required: true,
          placeholder: 'Sélectionner un statut',
          icon: <CheckCircle className="h-4 w-4" />,
          options: [
            { value: 'ACTIF', label: 'Actif' },
            { value: 'INACTIF', label: 'Inactif' }
          ]
        }
      ]
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Modifier le commercial" : "Ajouter un nouveau commercial"}
      description="Remplissez les informations du commercial étape par étape"
      variant="info"
      icon={<Building className="h-6 w-6" />}
      size="xl"
      maxWidth="max-w-4xl"
    >
      <ModalContent>
        <ModernForm
          steps={formSteps}
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={onClose}
          submitText={isEditing ? "Mettre à jour" : "Créer le commercial"}
          cancelText="Annuler"
          loading={isSubmitting}
          showProgress={true}
          allowStepNavigation={true}
        />
      </ModalContent>
    </Modal>
  );
};

// Composant de confirmation de suppression
interface DeleteCommercialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  commercialName: string;
}

export const DeleteCommercialModal: React.FC<DeleteCommercialModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  commercialName
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supprimer le commercial"
      description={`Êtes-vous sûr de vouloir supprimer ${commercialName} ? Cette action est irréversible.`}
      variant="error"
      icon={<AlertCircle className="h-6 w-6" />}
      size="md"
    >
      <ModalContent>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium mb-1">Attention</p>
                <p>
                  La suppression de ce commercial entraînera également la suppression de toutes ses données associées 
                  (prospections, statistiques, etc.). Cette action ne peut pas être annulée.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      
      <ModalActions>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isDeleting}
        >
          Annuler
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          loading={isDeleting}
          loadingText="Suppression..."
        >
          Supprimer définitivement
        </Button>
      </ModalActions>
    </Modal>
  );
};
