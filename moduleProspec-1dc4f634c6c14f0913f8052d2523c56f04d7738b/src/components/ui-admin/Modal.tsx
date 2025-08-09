// src/components/ui/Modal.tsx
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string; // New prop for max-width
  overlayClassName?: string; // Customize backdrop appearance
}

export const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-6xl", overlayClassName }: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClassName ?? "bg-black/80"}`}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative bg-white rounded-lg shadow-xl w-full ${maxWidth}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
