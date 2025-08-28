// frontend-shadcn/src/pages/manager/zones/columns.tsx

"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MapPin, Users, Calendar } from "lucide-react"
import { Button } from "@/components/ui-admin/button"

import { format } from "date-fns"
import { fr } from "date-fns/locale"

export type Zone = {
  id: string;
  name: string;
  assignedTo: string;
  color: string;
  latlng: [number, number];
  radius: number;
  dateCreation: string;
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

export const createColumns = (): ColumnDef<Zone>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader title="Nom de la zone" column={column} />,
    cell: ({ row }) => {
      const zone = row.original;
      return (
        <div className="flex items-center gap-3">
          <div 
            className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
            style={{ backgroundColor: zone.color }}
          />
          <span className="font-medium text-slate-900">{zone.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "assignedTo",
    header: ({ column }) => <SortableHeader title="Assignée à" column={column} />,
    cell: ({ row }) => {
      const assignedTo = row.original.assignedTo;
      return (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-slate-700">{assignedTo}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "radius",
    header: ({ column }) => <SortableHeader title="Rayon" column={column} />,
    cell: ({ row }) => {
      const radius = row.original.radius;
      return (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span className="text-slate-700">{radius}m</span>
        </div>
      )
    },
  },
  {
    accessorKey: "dateCreation",
    header: ({ column }) => <SortableHeader title="Date de création" column={column} />,
    cell: ({ row }) => {
      const date = row.original.dateCreation;
      return (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-slate-700">
            {format(new Date(date), 'dd/MM/yyyy', { locale: fr })}
          </span>
        </div>
      )
    },
  },
]
