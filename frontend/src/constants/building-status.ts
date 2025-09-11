import { CheckCircle, XCircle, Info, Loader2 } from 'lucide-react';
import { type BuildingStatusConfig } from '../types/types';

export const buildingStatusMap: BuildingStatusConfig = {
    NON_CONFIGURE: { label: "Non configuré", className: "bg-slate-100 text-slate-600", icon: XCircle },
    NON_COMMENCE: { label: "À commencer", className: "bg-yellow-100 text-yellow-700", icon: Info },
    EN_COURS: { label: "En cours", className: "bg-blue-100 text-blue-700", icon: Loader2 },
    COMPLET: { label: "Complet", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
};