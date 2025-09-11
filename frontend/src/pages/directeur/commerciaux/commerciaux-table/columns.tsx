import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui-admin/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui-admin/dropdown-menu';
import { Badge } from '@/components/ui-admin/badge';

export interface Commercial {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  manager?: string;
  equipe?: string;
  performance: number;
  objectifsAtteints: number;
  contratsSignes: number;
  rdvPris: number;
  statut: 'actif' | 'inactif';
  dateCreation: string;
  classement: number;
}

export const createColumns = (
  isDeleteMode: boolean = false,
  onDelete?: (id: string) => void
): ColumnDef<Commercial>[] => [
  {
    accessorKey: 'classement',
    header: '#',
    cell: ({ getValue }) => (
      <div className="text-center font-medium">
        {getValue<number>() || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'nom',
    header: 'Nom',
    cell: ({ row }) => (
      <div className="font-medium">
        {row.original.prenom} {row.original.nom}
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue }) => (
      <div className="text-sm text-muted-foreground">
        {getValue<string>()}
      </div>
    ),
  },
  {
    accessorKey: 'telephone',
    header: 'Téléphone',
    cell: ({ getValue }) => (
      <div className="text-sm">
        {getValue<string>() || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'manager',
    header: 'Manager',
    cell: ({ getValue }) => (
      <div className="text-sm">
        {getValue<string>() || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'equipe',
    header: 'Équipe',
    cell: ({ getValue }) => (
      <div className="text-sm">
        {getValue<string>() || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'performance',
    header: 'Performance',
    cell: ({ getValue }) => {
      const performance = getValue<number>();
      const color = performance >= 90 ? 'bg-green-100 text-green-800' : 
                   performance >= 75 ? 'bg-orange-100 text-orange-800' : 
                   'bg-red-100 text-red-800';
      return (
        <Badge className={color}>
          {performance}%
        </Badge>
      );
    },
  },
  {
    accessorKey: 'objectifsAtteints',
    header: 'Objectifs',
    cell: ({ getValue }) => {
      const objectifs = getValue<number>();
      const color = objectifs >= 90 ? 'bg-green-100 text-green-800' : 
                   objectifs >= 75 ? 'bg-orange-100 text-orange-800' : 
                   'bg-red-100 text-red-800';
      return (
        <Badge className={color}>
          {objectifs}%
        </Badge>
      );
    },
  },
  {
    accessorKey: 'contratsSignes',
    header: 'Contrats',
    cell: ({ getValue }) => (
      <div className="text-center font-medium">
        {getValue<number>()}
      </div>
    ),
  },
  {
    accessorKey: 'rdvPris',
    header: 'RDV',
    cell: ({ getValue }) => (
      <div className="text-center font-medium">
        {getValue<number>()}
      </div>
    ),
  },
  {
    accessorKey: 'statut',
    header: 'Statut',
    cell: ({ getValue }) => {
      const statut = getValue<string>();
      return (
        <Badge variant={statut === 'actif' ? 'default' : 'secondary'}>
          {statut === 'actif' ? 'Actif' : 'Inactif'}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const commercial = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Ouvrir le menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => window.open(`/directeur/commerciaux/${commercial.id}`, '_blank')}
            >
              <Eye className="mr-2 h-4 w-4" />
              Voir détails
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(`/directeur/commerciaux/${commercial.id}/edit`, '_blank')}
            >
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            {isDeleteMode && onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(commercial.id)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

