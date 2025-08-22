// src/components/ui/Modal.tsx
import { X, AlertCircle, Info, CheckCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  icon?: ReactNode;
  description?: string;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]'
};

const variantStyles = {
  default: {
    header: 'bg-white',
    icon: null,
    iconColor: 'text-slate-600'
  },
  success: {
    header: 'bg-gradient-to-r from-green-50 to-emerald-50',
    icon: <CheckCircle className="h-6 w-6 text-green-600" />,
    iconColor: 'text-green-600'
  },
  warning: {
    header: 'bg-gradient-to-r from-yellow-50 to-orange-50',
    icon: <AlertCircle className="h-6 w-6 text-yellow-600" />,
    iconColor: 'text-yellow-600'
  },
  error: {
    header: 'bg-gradient-to-r from-red-50 to-pink-50',
    icon: <AlertCircle className="h-6 w-6 text-red-600" />,
    iconColor: 'text-red-600'
  },
  info: {
    header: 'bg-gradient-to-r from-blue-50 to-indigo-50',
    icon: <Info className="h-6 w-6 text-blue-600" />,
    iconColor: 'text-blue-600'
  }
};

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = "max-w-2xl", 
  overlayClassName,
  showCloseButton = true,
  closeOnOverlayClick = true,
  variant = 'default',
  icon,
  description,
  footer,
  size = 'lg'
}: ModalProps) => {
  const variantStyle = variantStyles[variant];
  const sizeClass = sizeClasses[size];

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4",
            overlayClassName ?? "bg-black/60 backdrop-blur-sm"
          )}
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative bg-white rounded-2xl shadow-2xl w-full border-0 overflow-hidden",
              sizeClass,
              maxWidth
            )}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ 
              duration: 0.3, 
              ease: 'easeOut',
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between p-6 border-b border-slate-200",
              variantStyle.header
            )}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {icon || variantStyle.icon}
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "text-xl font-semibold truncate",
                    variantStyle.iconColor
                  )}>
                    {title}
                  </h3>
                  {description && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {showCloseButton && (
                <button 
                  onClick={onClose} 
                  className={cn(
                    "p-2 rounded-full transition-all duration-200 hover:bg-slate-100",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    "group"
                  )}
                  aria-label="Fermer la modal"
                >
                  <X className="h-5 w-5 text-slate-500 group-hover:text-slate-700 transition-colors" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Composants utilitaires pour les modals
export const ModalContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("space-y-4", className)}>
    {children}
  </div>
);

export const ModalSection = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("space-y-3", className)}>
    {children}
  </div>
);

export const ModalActions = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("flex justify-end gap-3 pt-4", className)}>
    {children}
  </div>
);

// Composants de modal spécialisés
export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirmer",
  cancelText = "Annuler",
  variant = 'warning',
  isLoading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  isLoading?: boolean;
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    variant={variant}
    size="md"
  >
    <ModalContent>
      <p className="text-slate-700 leading-relaxed">
        {message}
      </p>
    </ModalContent>
    <ModalActions>
      <button
        onClick={onClose}
        disabled={isLoading}
        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
      >
        {cancelText}
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading}
        className={cn(
          "px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50",
          variant === 'error' && "bg-red-600 hover:bg-red-700 focus:ring-red-500",
          variant === 'warning' && "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
          variant === 'success' && "bg-green-600 hover:bg-green-700 focus:ring-green-500",
          variant === 'info' && "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
          variant === 'default' && "bg-slate-600 hover:bg-slate-700 focus:ring-slate-500"
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Chargement...
          </div>
        ) : (
          confirmText
        )}
      </button>
    </ModalActions>
  </Modal>
);

export const AlertModal = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  variant = 'info',
  buttonText = "OK"
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  buttonText?: string;
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    variant={variant}
    size="md"
  >
    <ModalContent>
      <p className="text-slate-700 leading-relaxed">
        {message}
      </p>
    </ModalContent>
    <ModalActions>
      <button
        onClick={onClose}
        className={cn(
          "px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors",
          variant === 'error' && "bg-red-600 hover:bg-red-700 focus:ring-red-500",
          variant === 'warning' && "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
          variant === 'success' && "bg-green-600 hover:bg-green-700 focus:ring-green-500",
          variant === 'info' && "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
          variant === 'default' && "bg-slate-600 hover:bg-slate-700 focus:ring-slate-500"
        )}
      >
        {buttonText}
      </button>
    </ModalActions>
  </Modal>
);
