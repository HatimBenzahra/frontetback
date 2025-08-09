// frontend-shadcn/src/components/ui/ViewToggleContainer.tsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Table as TableIcon, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils'; // N'oubliez pas d'importer 'cn'

interface ViewToggleContainerProps {
  title: string;
  description: string;
  view: 'table' | 'map';
  onViewChange: (view: 'table' | 'map') => void;
  tableComponent: React.ReactNode;
  mapComponent: React.ReactNode;
}

export const ViewToggleContainer = ({
  title,
  description,
  view,
  onViewChange,
  tableComponent,
  mapComponent
}: ViewToggleContainerProps) => {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1 rounded-lg border p-1 bg-muted/50">
            {/* --- CORRECTION DES BOUTONS ICI --- */}
            <Button
              variant='ghost'
              className={cn("transition-all", view === 'table' ? 'bg-[hsl(var(--winvest-blue-clair))] text-[hsl(var(--winvest-blue-nuit))] hover:bg-[hsl(var(--winvest-blue-clair))]' : 'text-black hover:bg-zinc-100')}
              onClick={() => onViewChange('table')}
            >
              <TableIcon className="mr-2 h-4 w-4" /> Tableau
            </Button>
            <Button
              variant='ghost'
              className={cn("transition-all", view === 'map' ? 'bg-[hsl(var(--winvest-blue-clair))] text-[hsl(var(--winvest-blue-nuit))] hover:bg-[hsl(var(--winvest-blue-clair))]' : 'text-black hover:bg-zinc-100')}
              onClick={() => onViewChange('map')}
            >
              <MapIcon className="mr-2 h-4 w-4" /> Carte
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        {view === 'table' && <div className="animate-in fade-in-0 p-6 pt-0">{tableComponent}</div>}
        {view === 'map' && <div className="animate-in fade-in-0 h-full p-0">{mapComponent}</div>}
      </CardContent>
    </Card>
  );
};
