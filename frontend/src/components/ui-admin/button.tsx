import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:not([class*='size-']):size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-blue-500",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500",
        outline:
          "border-2 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 focus-visible:ring-slate-500",
        secondary:
          "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-500",
        ghost:
          "text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-500",
        link: "text-blue-600 underline-offset-4 hover:underline focus-visible:ring-blue-500",
        success:
          "bg-green-600 text-white shadow-sm hover:bg-green-700 active:bg-green-800 focus-visible:ring-green-500",
        warning:
          "bg-yellow-600 text-white shadow-sm hover:bg-yellow-700 active:bg-yellow-800 focus-visible:ring-yellow-500",
        gradient:
          "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 focus-visible:ring-blue-500",
        gradientSuccess:
          "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-sm hover:from-green-700 hover:to-emerald-700 active:from-green-800 active:to-emerald-800 focus-visible:ring-green-500",
        gradientWarning:
          "bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-sm hover:from-yellow-700 hover:to-orange-700 active:from-yellow-800 active:to-orange-800 focus-visible:ring-yellow-500",
        gradientDestructive:
          "bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-sm hover:from-red-700 hover:to-pink-700 active:from-red-800 active:to-pink-800 focus-visible:ring-red-500",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        xl: "h-14 rounded-xl px-8 text-lg",
        icon: "h-10 w-10",
        iconSm: "h-8 w-8",
        iconLg: "h-12 w-12",
      },
      loading: {
        true: "cursor-wait",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      loading: false,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    loading = false,
    loadingText,
    leftIcon,
    rightIcon,
    children,
    asChild = false, 
    disabled,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const isDisabled = disabled || loading;
    const displayText = loading && loadingText ? loadingText : children;

    // Si asChild est true, on ne rend que les enfants sans wrapper
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, loading, className }))}
          ref={ref}
          disabled={isDisabled}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    // Sinon, on rend le bouton normal avec tous les éléments
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, loading, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        
        {displayText}
        
        {!loading && rightIcon && rightIcon}
      </Comp>
    )
  }
)
Button.displayName = "Button"

// Composants de bouton spécialisés
export const PrimaryButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="gradient" {...props} />
);
PrimaryButton.displayName = "PrimaryButton";

export const SuccessButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="gradientSuccess" {...props} />
);
SuccessButton.displayName = "SuccessButton";

export const WarningButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="gradientWarning" {...props} />
);
WarningButton.displayName = "WarningButton";

export const DangerButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="gradientDestructive" {...props} />
);
DangerButton.displayName = "DangerButton";

export const IconButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'size'>>(
  (props, ref) => <Button ref={ref} size="icon" {...props} />
);
IconButton.displayName = "IconButton";

// Composant de bouton avec confirmation
interface ConfirmButtonProps extends ButtonProps {
  confirmMessage?: string;
  onConfirm: () => void;
  confirmTitle?: string;
  confirmVariant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({
  confirmMessage = "Êtes-vous sûr de vouloir effectuer cette action ?",
  onConfirm,
  confirmTitle = "Confirmation",
  confirmVariant = 'warning',
  children,
  onClick,
  ...props
}) => {
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    onConfirm();
    setShowConfirm(false);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <Button onClick={handleClick} {...props}>
        {children}
      </Button>
      
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {confirmTitle}
            </h3>
            <p className="text-slate-600 mb-6">
              {confirmMessage}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                size="sm"
              >
                Annuler
              </Button>
              <Button
                variant={confirmVariant === 'error' ? 'destructive' : 
                        confirmVariant === 'success' ? 'success' : 
                        confirmVariant === 'warning' ? 'warning' : 'default'}
                onClick={handleConfirm}
                size="sm"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { Button, buttonVariants }
