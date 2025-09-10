import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Eye, Edit } from 'lucide-react';
import { Button } from '@/components/ui-admin/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui-admin/dropdown-menu';
import { Badge } from '@/components/ui-admin/badge';

export interface EquipeDuManager {
  id: string;
  nom: string;
  commerciaux: number;
  performance: number;
  objectifsAtteints: number;
  contratsSignes: number;
  rdvPris: number;
  statut: 'actif' | 'inactif';
  dateCreation: string;
}

export const createEquipesColumns = (): ColumnDef<EquipeDuManager>[] => [
  {
    accessorKey: 'nom',
    header: 'Nom de l\'équipe',
    cell: ({ getValue }) => (
      <div className="font-medium">
        {getValue<string>()}
      </div>
    ),
  },
  {
    accessorKey: 'commerciaux',
    header: 'Commerciaux',
    cell: ({ getValue }) => (
      <div className="text-center font-medium">
        {getValue<number>()}
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
      const equipe = row.original;

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
              onClick={() => window.open(`/directeur/equipes/${equipe.id}`, '_blank')}
            >
              <Eye className="mr-2 h-4 w-4" />
              Voir détails
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(`/directeur/equipes/${equipe.id}/edit`, '_blank')}
            >
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

