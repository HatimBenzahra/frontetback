// frontend-shadcn/src/pages/admin/immeubles/columns.tsx

"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Link } from "react-router-dom";
import { ArrowUpDown, Eye, User, MapPin, Users, Trash2 } from "lucide-react"
import { Button } from "@/components/ui-admin/button"
import { Badge } from "@/components/ui-admin/badge"
import { Checkbox } from "@/components/ui-admin/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui-admin/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui-admin/avatar";
import { cn } from "@/lib/utils";
import { buildingStatusMap } from "@/constants/building-status";
import type { BuildingStatus } from "@/types/types";

export type Immeuble = {
  id: string;
  adresse: string;
  ville: string;
  codePostal: string;
  status: string; // Utilise les labels de buildingStatusMap
  nbPortes: number;
  nbPortesProspectees: number;
  prospectingMode: "Solo" | "Duo";
  prospectors: {
    id: string;
    nom: string;
    avatarFallback: string;
  }[];
  dateVisite: string | null;
  zone: string;
  zoneId: string;
  latlng: [number, number];
}

const Header = ({ title }: { title: string }) => (
  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
)

const SortableHeader = ({ title, column }: { title: string, column: any }) => (
  <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 h-8 hover:bg-transparent">
    <Header title={title} />
    <ArrowUpDown className="ml-2 h-3 w-3" />
  </Button>
)

// Configuration des statuts cohérente avec le côté commercial
const statusConfig: { [key: string]: string } = {
    "Non configuré": buildingStatusMap.NON_CONFIGURE.className,
    "À commencer": buildingStatusMap.NON_COMMENCE.className,
    "En cours": buildingStatusMap.EN_COURS.className,
    "Complet": buildingStatusMap.COMPLET.className,
    // Pour les statuts avec compteurs (ex: "En cours (5/10)")
    "En cours (": buildingStatusMap.EN_COURS.className,
};

export const createColumns = (
    onFocusOnImmeuble: (immeuble: Immeuble) => void = () => {},
    onFocusOnZone: (zoneId: string) => void = () => {},
    onDeleteImmeuble: (immeubleId: string) => void = () => {},
    isDeleteMode: boolean = false
): ColumnDef<Immeuble>[] => {

    const columns: ColumnDef<Immeuble>[] = [
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
      accessorKey: "adresse",
      header: ({ column }) => <SortableHeader title="Adresse" column={column} />,
      cell: ({ row }) => {
        const immeuble = row.original;
        return (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="group cursor-pointer" onClick={(e) => { e.stopPropagation(); onFocusOnImmeuble(immeuble); }}>
                  <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {immeuble.adresse}
                  </div>
                  <div className="text-sm text-slate-500 group-hover:text-blue-500 transition-colors">
                    {`${immeuble.codePostal} ${immeuble.ville}`}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Voir sur la carte
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader title="Statut" column={column} />,
      cell: ({ row }) => {
        const status = row.original.status;
        const className = statusConfig[status] || statusConfig["En cours ("] || "bg-gray-100 text-gray-800";
        return <Badge variant="outline" className={className}>{status}</Badge>
      }
    },
    {
        id: "couverture",
        header: ({ column }) => <SortableHeader title="Couverture" column={column} />,
        cell: ({ row }) => {
            const { nbPortes, nbPortesProspectees } = row.original;
            if (nbPortes === 0) return <span className="text-slate-400">N/A</span>;
            const percentage = (nbPortesProspectees / nbPortes) * 100;
            const getColorClass = (perc: number) => {
                if (perc >= 75) return "text-emerald-600 bg-emerald-50";
                if (perc >= 50) return "text-amber-600 bg-amber-50";
                if (perc >= 25) return "text-orange-600 bg-orange-50";
                return "text-red-600 bg-red-50";
            };
            return (
                <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded-md text-sm font-semibold ${getColorClass(percentage)}`}>
                        {percentage.toFixed(0)}%
                    </div>
                    <span className="text-xs text-slate-500">
                        ({nbPortesProspectees}/{nbPortes})
                    </span>
                </div>
            )
        },
        sortingFn: (rowA, rowB) => {
            const percA = rowA.original.nbPortes > 0 ? (rowA.original.nbPortesProspectees / rowA.original.nbPortes) : -1;
            const percB = rowB.original.nbPortes > 0 ? (rowB.original.nbPortesProspectees / rowB.original.nbPortes) : -1;
            return percA - percB;
        }
    },
    {
        accessorKey: "zone",
        header: ({ column }) => <SortableHeader title="Zone" column={column} />,
        cell: ({ row }) => (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                  <div className="group flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); onFocusOnZone(row.original.zoneId); }} >
                    <div className="p-1 rounded bg-slate-100 group-hover:bg-blue-100 transition-colors">
                      <MapPin className="h-3 w-3 text-slate-600 group-hover:text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-700 group-hover:text-blue-700 transition-colors">
                      {row.original.zone}
                    </span>
                  </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Voir la zone sur la carte
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
    },
    {
        accessorKey: "prospectingMode",
        header: ({ column }) => <SortableHeader title="Mode" column={column} />,
        cell: ({ row }) => {
            const { prospectingMode, prospectors } = row.original;
            if (prospectors.length === 0) {
                return <span className="text-slate-400">-</span>;
            }
            const Icon = prospectingMode === 'Duo' ? Users : User;
            const isDuo = prospectingMode === 'Duo';
            return (
                <Badge 
                    variant="secondary" 
                    className={cn(
                        "font-medium shadow-sm",
                        isDuo 
                            ? "bg-purple-50 text-purple-700 border-purple-200" 
                            : "bg-blue-50 text-blue-700 border-blue-200"
                    )}
                >
                    <Icon className="h-3 w-3 mr-1.5" />
                    {prospectingMode}
                </Badge>
            );
        }
    },
    {
        accessorKey: "prospectors",
        header: ({ column }) => <SortableHeader title="Prospecteurs" column={column} />,
        cell: ({ row }) => {
            const { prospectors } = row.original;
            if (!prospectors || prospectors.length === 0) {
                return <span className="text-slate-400">N/A</span>;
            }
            return (
                <div className="flex items-center">
                    <div className="flex -space-x-2">
                        {prospectors.map((p, index) => (
                            <TooltipProvider key={p.id} delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Link 
                                            to={`/admin/commerciaux/${p.id}`} 
                                            onClick={(e) => e.stopPropagation()} 
                                            className="hover:z-10 transition-transform hover:scale-110"
                                            style={{ zIndex: prospectors.length - index }}
                                        >
                                            <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-slate-200 hover:ring-2 hover:ring-blue-300 transition-all">
                                                <AvatarFallback className="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 font-semibold text-sm">
                                                    {p.avatarFallback}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="font-medium">{p.nom}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                    {prospectors.length > 0 && (
                        <span className="ml-3 text-xs text-slate-500 font-medium">
                            {prospectors.length} commercial{prospectors.length > 1 ? 'aux' : ''}
                        </span>
                    )}
                </div>
            );
        },
        sortingFn: (rowA, rowB) => {
            const nameA = rowA.original.prospectors[0]?.nom || '';
            const nameB = rowB.original.prospectors[0]?.nom || '';
            return nameA.localeCompare(nameB);
        }
    },
    {
        id: "actions",
        header: () => <div className="text-right"><Header title="Actions" /></div>,
        cell: ({ row }) => {
            const immeuble = row.original;
            return ( 
                <div className="text-right flex items-center justify-end gap-1">
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    asChild 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0 cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors rounded-full"
                                >
                                    <Link to={`/admin/immeubles/${immeuble.id}`} onClick={(e) => e.stopPropagation()}>
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">Voir les détails de l'immeuble</span>
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Voir les détails</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteImmeuble(immeuble.id);
                                    }}
                                    className="h-8 w-8 p-0 cursor-pointer hover:bg-red-50 hover:text-red-600 transition-colors rounded-full"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Supprimer l'immeuble</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Supprimer</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div> 
            )
        },
    },
    ];

    return columns;
}