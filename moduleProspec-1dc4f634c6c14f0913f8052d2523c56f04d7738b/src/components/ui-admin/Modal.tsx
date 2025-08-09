// src/components/ui/Modal.tsx
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string; // New prop for max-width
  overlayClassName?: string; // Customize backdrop appearance
}

export const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-6xl", overlayClassName }: ModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClassName ?? "bg-black/80"} animate-in fade-in-0`}
      onClick={onClose}
    >
      <div
        className={`relative bg-white rounded-lg shadow-xl w-full ${maxWidth} animate-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
