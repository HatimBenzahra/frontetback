import type { Column, ColumnDef } from "@tanstack/react-table"
import { Link } from "react-router-dom"
import { ArrowUpDown, Users as CommerciauxIcon, Eye, Award, Edit } from "lucide-react"
import { Button } from "@/components/ui-admin/button"
import { Badge } from "@/components/ui-admin/badge"
import { Checkbox } from "@/components/ui-admin/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui-admin/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui-admin/tooltip"

export type Equipe = {
  id: string;
  nom: string;
  manager: {
    id: string; 
    nom: string;
    avatarFallback: string;
  };
  nbCommerciaux: number;
  classementGeneral: number;
  totalContratsSignes: number;
}

const Header = ({ title }: { title: string }) => (
  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
)
const SortableHeader = ({ title, column }: { title: string, column: Column<Equipe, unknown> }) => (
  <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 h-8 hover:bg-transparent">
    <Header title={title} />
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
)

export const createEquipesColumns = (isDeleteMode: boolean, onEdit: (equipe: Equipe) => void): ColumnDef<Equipe>[] => {
  return [
    ...(isDeleteMode ? [{
      id: "select",
      header: ({ table }: { table: import("@tanstack/react-table").Table<Equipe> }) => (
        <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Select all" />
      ),
      cell: ({ row }: { row: import("@tanstack/react-table").Row<Equipe> }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" onClick={(e) => e.stopPropagation()} />
      ),
      enableSorting: false, enableHiding: false,
    }] : []),
    {
      accessorKey: "nom",
      header: ({ column }) => <SortableHeader title="Nom de l'équipe" column={column} />,
      cell: ({ row }) => <div className="font-medium text-foreground">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "manager",
      header: () => <Header title="Manager responsable" />,
      cell: ({ row }) => {
        const manager = row.original.manager
        return (
          <Link to={`/admin/managers/${manager.id}`} className="flex items-center gap-2 group" onClick={(e) => e.stopPropagation()}>
            <Avatar className="h-8 w-8">
              <AvatarFallback>{manager.avatarFallback}</AvatarFallback>
            </Avatar>
            <span className="group-hover:underline group-hover:text-primary transition-colors">{manager.nom}</span>
          </Link>
        )
      },
      sortingFn: (rowA, rowB) => {
        return rowA.original.manager.nom.localeCompare(rowB.original.manager.nom);
      }
    },
    {
      accessorKey: "nbCommerciaux",
      header: () => <div className="text-center"><Header title="Effectif" /></div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <CommerciauxIcon className="h-4 w-4 text-muted-foreground" />
          <span>{row.getValue("nbCommerciaux")}</span>
        </div>
      )
    },
    {
      accessorKey: "classementGeneral",
      header: ({ column }) => <div className="flex justify-center"><SortableHeader title="Classement" column={column} /></div>,
      meta: { className: "text-center" },
      cell: ({ row }) => {
        const classement = row.getValue("classementGeneral") as number;
        let badgeClass = "";
        if (classement === 1) badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-300";
        else if (classement === 2) badgeClass = "bg-slate-200 text-slate-800 border-slate-300";
        else if (classement === 3) badgeClass = "bg-orange-200 text-orange-800 border-orange-300";
        else badgeClass = "bg-gray-100 text-gray-800 border-gray-300";
        
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className={badgeClass}>
              <Award className="mr-1 h-3 w-3" />
              {classement}
            </Badge>
          </div>
        );
      },
    },
    {
        id: "actions",
        header: () => <div className="text-right"><Header title="Actions" /></div>,
        cell: ({ row }) => {
            const equipe = row.original;
            return (
              <TooltipProvider delayDuration={100}>
                <div className="text-right space-x-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link 
                          to={`/admin/equipes/${equipe.id}`} 
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
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onEdit(equipe); }}>
                            <Edit className="h-4 w-4" />
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
}