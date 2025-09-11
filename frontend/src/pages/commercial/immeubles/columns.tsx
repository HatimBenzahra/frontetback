"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Edit } from "lucide-react"
import { Button } from "@/components/ui-admin/button"
import { Checkbox } from "@/components/ui-admin/checkbox"
import { Badge } from "@/components/ui-admin/badge"

// Type pour les données de la table
export type ImmeubleCommercial = {
  id: string;
  nom: string | null;
  adresse: string;
  zone: { nom: string };
  status: string;
}

// Fonction pour styliser les badges de statut
const getStatusBadgeClass = (status: string) => {
    switch(status) {
        case 'A_VISITER': return "bg-blue-100 text-blue-800 border-blue-300";
        case 'VISITE': return "bg-gray-100 text-gray-800 border-gray-300";
        case 'RDV_PRIS': return "bg-green-100 text-green-800 border-green-300";
        case 'INACCESSIBLE': return "bg-red-100 text-red-800 border-red-300";
        default: return "bg-gray-100";
    }
}

export const createImmeublesColumns = (
    isDeleteMode: boolean, 
    onEdit: (immeuble: ImmeubleCommercial) => void
): ColumnDef<ImmeubleCommercial>[] => [
    ...(isDeleteMode ? [{
        id: "select", 
        header: ({ table }: any) => (<Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Select all" />), 
        cell: ({ row }: any) => (<Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" onClick={(e) => e.stopPropagation()} />), 
    }] : []),

    {
      accessorKey: "nom",
      header: "Nom / Référence",
      cell: ({ row }) => <div className="font-semibold">{row.original.nom || 'N/A'}</div>,
    },
    {
      accessorKey: "adresse",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Adresse <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.original.adresse}</div>
    },
    {
      accessorKey: "zone.nom",
      header: "Zone",
      cell: ({ row }) => <Badge variant="secondary">{row.original.zone.nom}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => <Badge variant="outline" className={getStatusBadgeClass(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge>
    },
    {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
            if (isDeleteMode) return null;
            return (
                <div className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(row.original)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                </div>
            )
        },
    },
]
