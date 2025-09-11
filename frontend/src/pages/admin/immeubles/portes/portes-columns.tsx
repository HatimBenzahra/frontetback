import { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';

export type PorteStatus = 'NON_VISITE' | 'VISITE' | 'ABSENT' | 'REFUS' | 'CURIEUX' | 'RDV' | 'CONTRAT_SIGNE';

export interface Porte {
  id: string;
  numeroPorte: string;
  etage: number; // Added missing etage property
  statut: PorteStatus;
  passage: number;
  commentaire: string | null;
  assigneeId: string | null; // Added assigneeId
}

interface CommercialColorMap {
  [commercialId: string]: string;
}

const commercialColors: CommercialColorMap = {};
let colorIndex = 0;
const colors = [
  'bg-blue-200', 'bg-green-200', 'bg-red-200', 'bg-purple-200', 'bg-yellow-200', 'bg-indigo-200', 'bg-pink-200', 'bg-teal-200'
];

const getCommercialColor = (commercialId: string) => {
  if (!commercialColors[commercialId]) {
    commercialColors[commercialId] = colors[colorIndex % colors.length];
    colorIndex++;
  }
  return commercialColors[commercialId];
};

export const createPortesColumns = (prospectors: { id: string; nom: string }[]): ColumnDef<Porte>[] => {
  return [
    {
      accessorKey: 'numeroPorte',
      header: 'N° Porte',
      cell: ({ row }) => {
        const porte = row.original;
        const commercialName = prospectors.find(p => p.id === porte.assigneeId)?.nom;
        const colorClass = porte.assigneeId ? getCommercialColor(porte.assigneeId) : '';
        return (
          <div className={cn("p-2 rounded-md", colorClass)}>
            {porte.numeroPorte} {commercialName && `(${commercialName})`}
          </div>
        );
      },
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => {
        const porte = row.original;
        const statusConfig: { [key in PorteStatus]: { label: string; className: string } } = {
          NON_VISITE: { label: 'Non visité', className: 'text-gray-500' },
          VISITE: { label: 'Visité', className: 'text-blue-500' },
          ABSENT: { label: 'Absent', className: 'text-orange-500' },
          REFUS: { label: 'Refus', className: 'text-red-500' },
          CURIEUX: { label: 'Curieux', className: 'text-purple-500' },
          RDV: { label: 'RDV', className: 'text-yellow-500' },
          CONTRAT_SIGNE: { label: 'Contrat signé', className: 'text-green-500' },
        };
        const config = statusConfig[porte.statut];
        return <span className={config.className}>{config.label}</span>;
      },
    },
    {
      accessorKey: 'passage',
      header: 'Repassage',
      cell: ({ row }) => {
        const passage = row.original.passage;
        if (passage === 0) {
          return <span className="text-muted-foreground">-</span>;
        } else if (passage === 1 || passage === 2) {
          return <span className="text-orange-500">À voir</span>;
        } else {
          return <span className="text-red-500">Non intéressé</span>;
        }
      },
    },
    {
      accessorKey: 'commentaire',
      header: 'Commentaire',
      cell: ({ row }) => row.original.commentaire || '-',
    },
  ];
};
