import { DataTable } from '@/components/data-table/DataTable';
import { createColumns } from '../suivi-table/columns';
import type { SuiviTableProps } from '@/types/types';

export const SuiviTable = ({ 
  commercials, 
  audioStreaming, 
  onShowOnMap, 
  onShowHistory, 
  onStartListening 
}: SuiviTableProps) => {
  const columns = createColumns(
    audioStreaming,
    onStartListening,
    onShowOnMap,
    onShowHistory
  );

  return (
    <div className="w-full">
      <DataTable
        columns={columns}
        data={commercials}
        filterColumnId="name"
        filterPlaceholder="Rechercher un commercial..."
        title="Suivi GPS en temps réel"
      />
    </div>
  );
}; 