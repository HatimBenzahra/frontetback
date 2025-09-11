import { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';

export type PorteStatus = 'NON_VISITE' | 'VISITE' | 'ABSENT' | 'REFUS' | 'CURIEUX' | 'RDV' | 'CONTRAT_SIGNE';

export interface Porte {
  id: string;
  numeroPorte: string;
  etage: number;
  statut: PorteStatus;
  passage: number;
  commentaire: string | null;
  assigneeId: string | null;
  dateRendezVous?: string | null;
  lastUpdated?: string;
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
      accessorKey: 'etage',
      header: 'Étage',
      cell: ({ row }) => {
        const etage = row.original.etage;
        return (
          <div className="text-center">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-medium text-sm">
              {etage}
            </span>
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
          NON_VISITE: { label: 'Non visité', className: 'bg-gray-100 text-gray-800 border-gray-200' },
          VISITE: { label: 'Visité', className: 'bg-blue-100 text-blue-800 border-blue-200' },
          ABSENT: { label: 'Absent', className: 'bg-orange-100 text-orange-800 border-orange-200' },
          REFUS: { label: 'Refus', className: 'bg-red-100 text-red-800 border-red-200' },
          CURIEUX: { label: 'Curieux', className: 'bg-purple-100 text-purple-800 border-purple-200' },
          RDV: { label: 'RDV', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
          CONTRAT_SIGNE: { label: 'Contrat signé', className: 'bg-green-100 text-green-800 border-green-200' },
        };
        const config = statusConfig[porte.statut];
        return (
          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", config.className)}>
            {config.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'passage',
      header: 'Repassage',
      cell: ({ row }) => {
        const passage = row.original.passage;
        if (passage === 0) {
          return <span className="text-slate-400">-</span>;
        } else if (passage === 1 || passage === 2) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
              À voir
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
              Non intéressé
            </span>
          );
        }
      },
    },
    {
      accessorKey: 'commentaire',
      header: 'Commentaire',
      cell: ({ row }) => row.original.commentaire || '-',
    },
    {
      accessorKey: 'dateRendezVous',
      header: 'RDV',
      cell: ({ row }) => {
        const dateRdv = row.original.dateRendezVous;
        if (!dateRdv) {
          return <span className="text-slate-400">-</span>;
        }
        const date = new Date(dateRdv);
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            {date.toLocaleDateString('fr-FR')}
          </span>
        );
      },
    },
  ];
};
