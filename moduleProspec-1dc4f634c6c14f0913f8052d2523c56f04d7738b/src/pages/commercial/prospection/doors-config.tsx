// src/pages/commercial/prospection/doors-config.tsx
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui-admin/button"
import { Badge } from "@/components/ui-admin/badge"
import { Edit, MessageSquare, Repeat, Hash, Check, BellOff, User, Smile, Frown, Landmark, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

export type PorteStatus = "NON_VISITE" | "VISITE" | "ABSENT" | "REFUS" | "CURIEUX" | "RDV" | "CONTRAT_SIGNE";
export type Porte = {
  id: string; 
  numero: string;
  etage: number;
  statut: PorteStatus;
  commentaire: string | null;
  passage: number;
  dateRendezVous?: string | null;
};

export const statusConfig: Record<PorteStatus, { 
    className: string; 
    icon: React.ElementType;
    badgeClassName: string;
    buttonClassName: string;
    label: string;
}> = {
    "NON_VISITE": { 
        className: "text-gray-800", 
        icon: BellOff,
        badgeClassName: "bg-gray-200 text-gray-800 border border-gray-300",
        buttonClassName: "bg-gray-500 hover:bg-gray-600",
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

export const createDoorsColumns = (
    onEdit: (porteId: string) => void,
    isBuildingFullyProspected: boolean
): ColumnDef<Porte>[] => [
    {
      accessorKey: "numero",
      header: "Porte",
      cell: ({ row }) => (
        <div className="font-bold flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground"/>
            {row.original.numero}
        </div>
      ),
      meta: { className: "w-[100px]" }
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => {
        const statut = row.original.statut;
        const config = statusConfig[statut];
        return <Badge variant="outline" className={cn("font-medium", config.badgeClassName)}><config.icon className="mr-1.5 h-3 w-3"/>{statut}</Badge>;
      }
    },
    {
        accessorKey: "passage",
        header: "Passages",
        cell: ({ row }) => {
            return <span>{row.original.passage}</span>
        }
    },
    {
        accessorKey: "repassage",
        header: "Repassage",
        cell: ({ row }) => {
            const { statut, passage } = row.original;

            // Define statuses where repassage is not applicable
            const noRepassageStatuses: PorteStatus[] = ["NON_VISITE", "VISITE", "CONTRAT_SIGNE", "REFUS"];

            if (noRepassageStatuses.includes(statut)) {
                return <span className="text-muted-foreground">-</span>;
            }

            // For statuses that might require repassage
            if (passage < 3) {
                return (
                    <div className="flex items-center gap-2 text-yellow-600 font-semibold">
                        <Repeat className="h-4 w-4" />
                        <span>À revoir</span>
                    </div>
                );
            } else { // passage >= 3
                return (
                    <div className="flex items-center gap-2 text-red-600 font-semibold">
                        <Repeat className="h-4 w-4" />
                        <span>Non intéressé</span>
                    </div>
                );
            }
        }
    },
    {
      accessorKey: "commentaire",
      header: "Commentaire",
      cell: ({ row }) => {
        const commentaire = row.original.commentaire;
        if (!commentaire) return <span className="italic text-muted-foreground">Aucun commentaire</span>;
        return (
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
            <span className="max-w-xs truncate">{commentaire}</span>
          </div>
        )
      },
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <div className="text-right">
                <Button variant="outline" size="icon" onClick={() => onEdit(row.original.id)} disabled={isBuildingFullyProspected}>
                    <Edit className="h-4 w-4" />
                </Button>
            </div>
        )
    }
];
