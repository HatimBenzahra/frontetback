export interface Commercial {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  equipeId?: string;
  managerId: string;
  currentMonthlyGoal?: number; // Ajouté pour correspondre au schéma Prisma
  historiques: { nbContratsSignes: number }[]; // Ajouté pour correspondre à l'API
  manager?: string;
  equipe?: string;
  classement?: number;
}

export interface Manager {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  nbEquipes?: number; // Rendu optionnel car peut être calculé
  classement?: number; // Rendu optionnel car peut être calculé
  equipes?: {
    id: string;
    nom: string;
    commerciaux?: {
      id: string;
      nom: string;
      prenom: string;
      telephone?: string;
      historiques?: {
        nbContratsSignes: number;
      }[];
    }[];
  }[];
}

export interface Zone {
  id: string;
  name: string;
  assignedTo?: string;
  color: string;
  latlng: [number, number];
  radius: number;
  dateCreation?: string;
  nbImmeubles?: number;
  totalContratsSignes?: number;
  totalRdvPris?: number;
}


export interface HistoryEntry {
  id: string; // ID de l'entrée d'historique
  immeubleId: string; // L'ID de l'immeuble associé à cette entrée d'historique
  adresse: string;
  ville: string;
  codePostal?: string; // Added for postal code
  dateProspection: string;
  nbPortesVisitees: number;
  totalNbPortesImmeuble?: number; // Added for total doors in the building
  nbContratsSignes: number;
  nbRdvPris: number;
  nbRefus: number;
  nbAbsents: number;
  commentaire: string;
  tauxCouverture: number;
  zoneName?: string; // Added for zone name
}

export interface CommercialDetails {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  equipe: {
    id: string;
    nom: string;
    manager: {
      id: string;
      nom: string;
      prenom: string;
    };
  };
}

export interface CommercialStats {
  commercialInfo: {
    nom: string;
    prenom: string;
    email: string;
  };
  kpis: {
    immeublesVisites: number;
    portesVisitees: number;
    contratsSignes: number;
    rdvPris: number;
    tauxDeConversion: number;
  };
  repartitionStatuts: {
    [key: string]: number;
  };
}


export type EnrichedCommercial = Commercial & {
  manager: string;
  equipe: string;
  classement: number;
  totalContratsSignes: number;
};

// Types for Immeuble management
export type ImmeubleFormState = {
  adresse: string;
  ville: string;
  codePostal: string;
  nbEtages?: number;
  nbPortesParEtage?: number;
  hasElevator: boolean;
  digicode?: string;
  latitude?: number;
  longitude?: number;
};

export type PorteWithEtage = {
  id: string;
  numeroPorte: string;
  statut: PorteStatus;
  etage: number;
};

export type PorteStatus = "NON_VISITE" | "VISITE" | "ABSENT" | "REFUS" | "CURIEUX" | "RDV" | "CONTRAT_SIGNE";

export type BuildingStatus = "NON_CONFIGURE" | "NON_COMMENCE" | "EN_COURS" | "COMPLET";

export type BuildingStatusConfig = {
  [key in BuildingStatus]: {
    label: string;
    className: string;
    icon: React.ElementType;
  };
};

// Additional types for building management components
export type FilterButtonProps = {
  filterKey: string;
  label: string;
  icon?: React.ReactNode;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
};

export type ImmeubleCardProps = {
  immeuble: any; // Will use the ImmeubleFromApi type from service
  onOpenDetailsModal: (immeuble: any) => void;
  onOpenEditModal: (immeuble: any) => void;
  onDelete: (id: string) => void;
  getProspectingStatus: (immeuble: any) => any;
  getBuildingDetails: (immeuble: any) => any;
};

export type ImmeubleDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedImmeuble: any | null;
  getProspectingStatus: (immeuble: any) => any;
  onGoToProspecting: () => void;
};

export type ImmeubleFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editingImmeuble: any | null;
  formState: ImmeubleFormState;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  formStep: number;
  onNextStep: () => void;
  onPrevStep: () => void;
  setFormState: React.Dispatch<React.SetStateAction<ImmeubleFormState>>;
};

export type FilterBarProps = {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onAddImmeuble: () => void;
};

// Types pour le suivi GPS des commerciaux
export interface CommercialGPS {
  id: string;
  name: string;
  avatarFallback: string;
  position: [number, number] | null; // [latitude, longitude] ou null si jamais connecté
  equipe: string;
  isOnline: boolean;
  isStreaming: boolean; // Si le commercial diffuse son audio
  lastUpdate: Date | null; // null si jamais connecté
  speed?: number; // km/h
  heading?: number; // degrés (0-360)
}

// Type pour l'historique de position
export interface LocationHistory {
  id: string;
  commercialId: string;
  position: [number, number];
  timestamp: Date;
  speed?: number;
  heading?: number;
}

// Types pour le suivi GPS et les composants modaux
export interface Zone {
  id: string;
  name: string;
  coordinates: [number, number][];
  color: string;
  latlng: [number, number];
  radius: number;
}

export interface AudioStreamingState {
  isConnected: boolean;
  isListening: boolean;
  currentListeningTo: string | null;
  error: string | null;
  audioVolume: number;
  setVolume: (volume: number) => void;
  connect: () => void;
  disconnect: () => void;
  startListening: (commercialId: string) => Promise<void>;
  stopListening: () => Promise<void>;
}

export interface SuiviPageState {
  commercials: CommercialGPS[];
  selectedCommercial: CommercialGPS | null;
  zones: Zone[];
  loading: boolean;
  showListeningModal: boolean;
  showMapModal: boolean;
  showHistoryModal: boolean;
  attemptedListeningTo: string | null;
  transcriptions: Record<string, string>;
  transcriptionHistory: TranscriptionSession[];
  loadingHistory: boolean;
  selectedCommercialForHistory: CommercialGPS | null;
  selectedSession: TranscriptionSession | null;
}

export interface SuiviPageActions {
  handleShowOnMap: (commercial: CommercialGPS) => void;
  handleShowHistory: (commercial: CommercialGPS) => Promise<void>;
  handleStartListening: (commercialId: string) => Promise<void>;
  handleStopListening: () => Promise<void>;
  setShowListeningModal: (show: boolean) => void;
  setShowMapModal: (show: boolean) => void;
  setShowHistoryModal: (show: boolean) => void;
  setSelectedCommercial: (commercial: CommercialGPS | null) => void;
  setSelectedCommercialForHistory: (commercial: CommercialGPS | null) => void;
  setSelectedSession: (session: TranscriptionSession | null) => void;
}

export interface TranscriptionSession {
  id: string;
  commercial_id: string;
  commercial_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  full_transcript: string;
  building_name?: string;
}

export interface SuiviStatsProps {
  commercials: CommercialGPS[];
  audioStreaming: AudioStreamingState;
}

export interface ListeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  commercial: CommercialGPS | null;
  audioStreaming: AudioStreamingState;
  transcription: string;
  onStopListening: () => Promise<void>;
}

export interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  commercial: CommercialGPS | null;
  transcriptionHistory: TranscriptionSession[];
  loadingHistory: boolean;
  selectedSession: TranscriptionSession | null;
  onSessionSelect: (session: TranscriptionSession) => void;
}

export interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  commercial: CommercialGPS | null;
  zones: Zone[];
  commercials: CommercialGPS[];
}

export interface SuiviTableProps {
  commercials: CommercialGPS[];
  audioStreaming: AudioStreamingState;
  onShowOnMap: (commercial: CommercialGPS) => void;
  onShowHistory: (commercial: CommercialGPS) => Promise<void>;
  onStartListening: (commercialId: string) => Promise<void>;
}
