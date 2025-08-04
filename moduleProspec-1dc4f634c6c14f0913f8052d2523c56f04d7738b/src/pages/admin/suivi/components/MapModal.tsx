import { Modal } from '@/components/ui-admin/Modal';
import { SuiviMap } from '../SuiviMap';
import type { MapModalProps } from '@/types/types';

export const MapModal = ({ isOpen, onClose, commercial, zones, commercials }: MapModalProps) => {
  if (!isOpen || !commercial) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Position de ${commercial.name}`}
      maxWidth="max-w-4xl"
    >
      <div className="h-[500px]">
        <SuiviMap 
          zones={zones}
          commercials={commercials}
          onMarkerClick={() => {}}
          selectedCommercialId={commercial.id}
        />
      </div>
    </Modal>
  );
}; 