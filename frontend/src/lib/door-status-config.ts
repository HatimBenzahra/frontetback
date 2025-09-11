import { BellOff, Eye, User, Smile, Frown, Check, Landmark } from 'lucide-react';

export type PorteStatus = "NON_VISITE" | "VISITE" | "ABSENT" | "REFUS" | "CURIEUX" | "RDV" | "CONTRAT_SIGNE";

export type Porte = {
  id: string; 
  numero: string;
  etage: number;
  statut: PorteStatus;
  commentaire: string | null;
  passage: number;
};

export const statusConfig: Record<PorteStatus, { 
    className: string; 
    icon: React.ElementType;
    badgeClassName: string;
    buttonClassName: string;
    label: string;
}> = {
    "NON_VISITE": { 
        className: "text-slate-800", 
        icon: BellOff,
        badgeClassName: "bg-slate-200 text-slate-800 border border-slate-300",
        buttonClassName: "bg-slate-500 hover:bg-slate-600",
        label: "Non visité"
    },
    "VISITE": { 
        className: "text-blue-800", 
        icon: Eye,
        badgeClassName: "bg-blue-100 text-blue-800 border border-blue-300",
        buttonClassName: "bg-blue-500 hover:bg-blue-600",
        label: "Visité"
    },
    "ABSENT": { 
        className: "text-yellow-800", 
        icon: User,
        badgeClassName: "bg-yellow-100 text-yellow-800 border border-yellow-300",
        buttonClassName: "bg-yellow-500 hover:bg-yellow-600",
        label: "Absent"
    },
    "CURIEUX": { 
        className: "text-purple-800", 
        icon: Smile,
        badgeClassName: "bg-purple-100 text-purple-800 border border-purple-300",
        buttonClassName: "bg-purple-500 hover:bg-purple-600",
        label: "Curieux"
    },
    "REFUS": { 
        className: "text-red-800", 
        icon: Frown,
        badgeClassName: "bg-red-100 text-red-800 border border-red-300",
        buttonClassName: "bg-red-500 hover:bg-red-600",
        label: "Refus"
    },
    "RDV": { 
        className: "text-sky-800", 
        icon: Check,
        badgeClassName: "bg-sky-100 text-sky-800 border border-sky-300",
        buttonClassName: "bg-sky-500 hover:bg-sky-600",
        label: "RDV"
    },
    "CONTRAT_SIGNE": { 
        className: "text-emerald-800", 
        icon: Landmark,
        badgeClassName: "bg-emerald-400 text-white border border-emerald-500",
        buttonClassName: "bg-emerald-500 hover:bg-emerald-600",
        label: "Signé"
    },
};

export const statusList = (Object.keys(statusConfig) as PorteStatus[]).filter(
  (status) => status !== "VISITE"
);