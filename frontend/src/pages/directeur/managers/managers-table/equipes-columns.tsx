// frontend-shadcn/src/pages/directeur/managers/managers-table/equipes-columns.tsx
"use client"

import type { ColumnDef, Column } from "@tanstack/react-table"
import { Link } from "react-router-dom"
import { ArrowUpDown, Mail, Phone, Eye, Edit } from "lucide-react"
import { Button } from "@/components/ui-admin/button"
import { Badge } from "@/components/ui-admin/badge"
import { Checkbox } from "@/components/ui-admin/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui-admin/tooltip"


export type Manager = {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string | null
  nbEquipes: number
  classement: number
  equipes: {
    id: string;
    nom: string;
    commerciaux: {
      id: string;
      nom: string;
      prenom: string;
      telephone: string;
      historiques: {
        nbContratsSignes: number;
      }[];
    }[];
  }[];
}

export type EquipeDuManager = {
  id: string;
  nom: string;
  nbCommerciaux: number;
  commerciaux: any[];
}

const Header = ({ title }: { title: string }) => (
  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
)

const SortableHeader = ({ title, column }: { title: string, column: Column<Manager> }) => (
  <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 h-8 hover:bg-transparent">
    <Header title={title} />
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
)

export const getColumns = (isDeleteMode: boolean, onEdit: (manager: Manager) => void): ColumnDef<Manager>[] => {
  const columns: ColumnDef<Manager>[] = [
    ...(isDeleteMode ? [{
      id: "select",
      header: ({ table }: { table: import("@tanstack/react-table").Table<Manager> }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }: { row: import("@tanstack/react-table").Row<Manager> }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }] : []),
    {
      accessorKey: "nom",
      header: ({ column }) => <SortableHeader title="Nom" column={column} />,
      cell: ({ row }) => <div className="font-medium text-foreground">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "prenom",
      header: () => <Header title="Prénom" />,
    },
    {
      accessorKey: "email",
      header: () => <Header title="Email" />,
      cell: ({ row }) => (
        <a href={`mailto:${row.getValue("email")}`} className="flex items-center gap-2 hover:underline">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {row.getValue("email")}
        </a>
      ),
    },
    {
      accessorKey: "telephone",
      header: () => <Header title="Téléphone" />,
      cell: ({ row }) => (
        <a href={`tel:${row.getValue("telephone")}`} className="flex items-center gap-2 hover:underline">
          <Phone className="h-4 w-4 text-muted-foreground" />
          {row.getValue("telephone")}
        </a>
      ),
    },
    {
      accessorKey: "nbEquipes",
      header: () => <div className="text-center"><Header title="Nb. d'équipes" /></div>,
      cell: ({ row }) => <div className="text-center">{row.getValue("nbEquipes")}</div>,
      meta: { className: "text-center" }
    },
    {
      accessorKey: "classement",
      header: ({ column }) => <div className="flex justify-center"><SortableHeader title="Classement" column={column} /></div>,
      meta: { className: "text-center" },
      cell: ({ row }) => {
        const classement = row.getValue("classement") as number;
        let badgeClass = "";
        if (classement === 1) badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200/80";
        else if (classement === 2) badgeClass = "bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300/80";
        else if (classement === 3) badgeClass = "bg-orange-200 text-orange-800 border-orange-300 hover:bg-orange-300/80";
        else badgeClass = "bg-gray-100 text-gray-800 border-gray-300";
        
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className={badgeClass}>{classement}</Badge>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right"><Header title="Actions" /></div>,
      cell: ({ row }) => {
        const manager = row.original;
        return (
          <TooltipProvider delayDuration={100}>
            <div className="text-right space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link 
                    to={`/directeur/managers/${manager.id}`} 
                    onClick={(e) => { e.stopPropagation(); }}
                    className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>Voir les détails</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onEdit(manager); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Modifier</p></TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )
      }
    },
  ]
  
  return columns;
}

export const createEquipesColumns = (): ColumnDef<EquipeDuManager>[] => {
  return [
    {
      accessorKey: "nom",
      header: () => <Header title="Nom de l'équipe" />,
      cell: ({ row }) => <div className="font-medium">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "nbCommerciaux",
      header: () => <div className="text-center"><Header title="Nb. commerciaux" /></div>,
      cell: ({ row }) => <div className="text-center">{row.getValue("nbCommerciaux")}</div>,
      meta: { className: "text-center" }
    },
  ];
}