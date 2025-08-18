import MapComponent from '@/components/MapComponent';
import type { Zone } from '@/types/types';

interface ZoneMapViewerProps {
  zones: Zone[];
  focusedZone: Zone | null;
  onMapLoad?: () => void;
}

export const ZoneMapViewer = ({ zones, focusedZone, onMapLoad }: ZoneMapViewerProps) => {
  return (
    <div className="h-full w-full">
      <MapComponent
        zones={zones}
        focusedZoneId={focusedZone?.id || null}
        onLoad={onMapLoad}
      />
    </div>
  );
};
