import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Headphones, Map, Eye } from "lucide-react"
import { Button } from "@/components/ui-admin/button"
import { Badge } from "@/components/ui-admin/badge"
import type { CommercialGPS } from "@/types/types"

const formatLastUpdate = (date: Date | null) => {
  if (!date) return 'Jamais connecté';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `${diffMinutes}min`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  
  return date.toLocaleDateString('fr-FR');
};

export const createColumns = (
  audioStreaming: {
    isConnected: boolean;
    isListening: boolean;
    currentListeningTo: string | null;
    error: string | null;
  },
  onStartListening: (commercialId: string) => Promise<void>,
  onShowOnMap: (commercial: CommercialGPS) => void,
  onShowHistory: (commercial: CommercialGPS) => void
): ColumnDef<CommercialGPS>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent p-0 font-semibold"
      >
        Commercial
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const commercial = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white ${
              commercial.isOnline ? 'bg-blue-600' : 'bg-gray-400'
            }`}>
              {commercial.avatarFallback}
            </div>
            {commercial.isOnline && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
          <div>
            <p className="font-medium">{commercial.name}</p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "equipe",
    header: "Équipe",
    cell: ({ row }) => (
      <span className="text-sm text-gray-600">{row.getValue("equipe")}</span>
    ),
  },
  {
    accessorKey: "isOnline",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent p-0 font-semibold"
      >
        Statut
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const isOnline = row.getValue("isOnline") as boolean;
      return (
        <Badge variant={isOnline ? "default" : "secondary"} className={isOnline ? "bg-green-500" : ""}>
          {isOnline ? "En ligne" : "Hors ligne"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "lastUpdate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-transparent p-0 font-semibold"
      >
        Dernière MAJ
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const lastUpdate = row.getValue("lastUpdate") as Date | null;
      return (
        <div className="flex items-center gap-2 text-sm">
          <span>{formatLastUpdate(lastUpdate)}</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const commercial = row.original;
      
      return (
        <div className="flex items-center gap-2">
          <Button
            variant={audioStreaming.currentListeningTo === commercial.id ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onStartListening(commercial.id);
            }}
            disabled={!commercial.isStreaming}
            className={`h-8 w-8 p-0 ${commercial.isStreaming ? 'opacity-100' : 'opacity-50'}`}
            title={commercial.isStreaming ? "Écouter (micro actif)" : "Commercial non disponible (micro inactif)"}
          >
            <Headphones className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onShowOnMap(commercial);
            }}
            disabled={!commercial.isOnline}
            className={`h-8 w-8 p-0 ${commercial.isOnline ? 'opacity-100' : 'opacity-50'}`}
            title={commercial.isOnline ? "Voir sur la carte" : "Commercial hors ligne (position non disponible)"}
          >
            <Map className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onShowHistory(commercial);
            }}
            className="h-8 w-8 p-0"
            title="Voir l'historique des transcriptions"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];