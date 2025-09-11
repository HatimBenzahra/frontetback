// frontend-shadcn/src/pages/admin/directeurs/directeurs-table/columns.tsx
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Link } from "react-router-dom"
import { ArrowUpDown, Mail, Phone, Eye, Edit, Users, Building2, Target } from "lucide-react"
import { Button } from "@/components/ui-admin/button"
import { Badge } from "@/components/ui-admin/badge"
import { Checkbox } from "@/components/ui-admin/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui-admin/tooltip"
import type { Directeur } from "@/services/directeur.service"

const Header = ({ title }: { title: string }) => (
  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
)

const SortableHeader = ({ title, column }: { title: string, column: any }) => (
  <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 h-8 hover:bg-transparent">
    <Header title={title} />
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
)

export const createDirecteurColumns = (
  isDeleteMode: boolean,
  onEdit: (directeur: Directeur) => void,
): ColumnDef<Directeur>[] => {
  const columns: ColumnDef<Directeur>[] = [
    // --- Colonne de sélection ---
    ...(isDeleteMode ? [{
      id: "select",
      header: ({ table }: { table: any }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }: { row: any }) => (
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

    // --- Colonnes de données ---
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
      )
    },
    {
      accessorKey: "telephone",
      header: () => <Header title="Téléphone" />,
      cell: ({ row }) => {
        const telephone = row.getValue("telephone") as string;
        if (!telephone) {
          return <span className="text-slate-500">Non renseigné</span>;
        }
        return (
          <a href={`tel:${telephone}`} className="flex items-center gap-2 hover:underline">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {telephone}
          </a>
        );
      }
    },
    {
      accessorKey: "nbManagers",
      header: () => <div className="text-center"><Header title="Managers" /></div>,
      cell: ({ row }) => {
        const nbManagers = row.getValue("nbManagers") as number || 0;
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Users className="h-3 w-3 mr-1" />
              {nbManagers}
            </Badge>
          </div>
        );
      },
      meta: { className: "text-center" }
    },
    {
      accessorKey: "nbEquipes",
      header: () => <div className="text-center"><Header title="Équipes" /></div>,
      cell: ({ row }) => {
        const nbEquipes = row.getValue("nbEquipes") as number || 0;
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              <Building2 className="h-3 w-3 mr-1" />
              {nbEquipes}
            </Badge>
          </div>
        );
      },
      meta: { className: "text-center" }
    },
    {
      accessorKey: "nbCommerciaux",
      header: () => <div className="text-center"><Header title="Commerciaux" /></div>,
      cell: ({ row }) => {
        const nbCommerciaux = row.getValue("nbCommerciaux") as number || 0;
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {nbCommerciaux}
            </Badge>
          </div>
        );
      },
      meta: { className: "text-center" }
    },
    {
      accessorKey: "totalContratsSignes",
      header: ({ column }) => <div className="flex justify-center"><SortableHeader title="Contrats" column={column} /></div>,
      meta: { className: "text-center" },
      cell: ({ row }) => {
        const contrats = row.getValue("totalContratsSignes") as number || 0;
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Target className="h-3 w-3 mr-1" />
              {contrats}
            </Badge>
          </div>
        );
      },
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
            const directeur = row.original;
            return (
                <TooltipProvider delayDuration={100}>
                    <div className="text-right space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link 
                              to={`/admin/directeurs/${directeur.id}`} 
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent><p>Voir les détails</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onEdit(directeur); }}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Modifier</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Modifier</p></TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            )
        },
    },
  ]
  
  return columns;
}