// frontend-shadcn/src/pages/admin/manager-details-table/equipes-columns.tsx
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Users, Flag } from "lucide-react"
import type { Commercial } from '../../commerciaux/commerciaux-table/columns';

export type EquipeDuManager = {
  id: string
  nom: string
  nbCommerciaux: number
  commerciaux: Commercial[];
}

const Header = ({ title }: { title: string }) => (
  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
)

export const createEquipesColumns = (): ColumnDef<EquipeDuManager>[] => [
  {
    accessorKey: "nom",
    header: () => <Header title="Nom de l'équipe" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Flag className="h-4 w-4 text-muted-foreground" />
        {row.getValue("nom")}
      </div>
    ),
  },
  {
    accessorKey: "nbCommerciaux",
    header: () => <div className="text-center"><Header title="Effectif" /></div>,
    cell: ({ row }) => (
      <div className="text-center flex items-center justify-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        {row.getValue("nbCommerciaux")}
      </div>
    )
  },
  // La colonne "Actions" est supprimée. La navigation se fera au clic de la ligne.
]