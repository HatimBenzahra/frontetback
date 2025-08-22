import { ArrowUpDown, Edit, Calendar, Eye } from "lucide-react"
import { Link } from "react-router-dom";
import { Button } from '@/components/ui-admin/button';
import { Checkbox } from '@/components/ui-admin/checkbox';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui-admin/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface Zone {
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

export const createZoneColumns = (isDeleteMode: boolean, onEdit: (zone: Zone) => void): ColumnDef<Zone>[] => [
    // Colonne de sélection conditionnelle
    ...(isDeleteMode ? [{
      id: "select",
      header: ({ table }: any) => (<Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Select all" />),
      cell: ({ row }: any) => (<Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" onClick={(e) => e.stopPropagation()} />),
      enableSorting: false, enableHiding: false,
    }] : []),
    {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader title="Nom de la zone" column={column} />,
        cell: ({ row }) => <div className="font-medium text-foreground">{row.original.name}</div>,
    },
    {
        accessorKey: "assignedTo",
        header: ({ column }: { column: any }) => <SortableHeader title="Assignée à" column={column} />,
        cell: ({ row }) => {
            const { color, assignedTo } = row.original;
            const badgeStyle = color ? { backgroundColor: color, color: 'white', borderColor: 'transparent' } : {};
            return ( <Badge style={badgeStyle} className="border-transparent">{assignedTo}</Badge> )
        }
    },
    {
        accessorKey: "dateCreation",
        header: ({ column }) => <SortableHeader title="Date d'ajout" column={column} />,
        cell: ({ row }) => (
            <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(row.original.dateCreation), "d LLL yyyy", { locale: fr })}</span>
            </div>
        )
    },
    {
        id: "actions",
        header: () => <div className="text-right"><Header title="Actions" /></div>,
        cell: ({ row }) => (
            <div className="text-right space-x-2">
                <Link 
                  to={`/admin/zones/${row.original.id}`} 
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}>
                    <Edit className="h-4 w-4" />
                </Button>
            </div>
        ),
    },
];
