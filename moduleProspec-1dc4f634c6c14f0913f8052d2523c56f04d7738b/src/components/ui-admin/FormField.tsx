import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';
import { Input } from './input';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  icon?: React.ReactNode;
  success?: boolean;
  variant?: 'default' | 'success' | 'error' | 'warning';
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ 
    label, 
    error, 
    hint, 
    required = false, 
    icon,
    success = false,
    variant = 'default',
    containerClassName,
    labelClassName,
    inputClassName,
    className,
    id,
    ...props 
  }, ref) => {
    const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    const getVariantStyles = () => {
      switch (variant) {
        case 'success':
          return {
            input: 'border-green-300 focus:border-green-500 focus:ring-green-100',
            icon: 'text-green-500',
            label: 'text-green-700'
          };
        case 'error':
          return {
            input: 'border-red-300 focus:border-red-500 focus:ring-red-100',
            icon: 'text-red-500',
            label: 'text-red-700'
          };
        case 'warning':
          return {
            input: 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-100',
            icon: 'text-yellow-500',
            label: 'text-yellow-700'
          };
        default:
          return {
            input: 'border-slate-200 focus:border-blue-500 focus:ring-blue-100',
            icon: 'text-slate-400',
            label: 'text-slate-700'
          };
      }
    };

    const variantStyles = getVariantStyles();

    return (
      <div className={cn("space-y-2", containerClassName)}>
        <Label 
          htmlFor={fieldId} 
          className={cn(
            "text-sm font-semibold flex items-center gap-2",
            variantStyles.label,
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>

        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <div className={cn("h-5 w-5", variantStyles.icon)}>
                {icon}
              </div>
            </div>
          )}
          
          <Input
            ref={ref}
            id={fieldId}
            className={cn(
              "h-12 text-base transition-all duration-200",
              "border-2 focus:ring-4 focus:ring-offset-0",
              icon && "pl-10",
              success && "pr-10",
              variantStyles.input,
              inputClassName,
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            {...props}
          />

          {success && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          )}
        </div>

        {error && (
          <div 
            id={errorId}
            className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {hint && !error && (
          <div 
            id={hintId}
            className="flex items-start gap-2 text-slate-600 text-sm"
          >
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{hint}</span>
          </div>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

// Composant de formulaire avec validation
interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({ 
  title, 
  description, 
  children, 
  className 
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-lg font-semibold text-slate-800">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-slate-600">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

// Composant de formulaire avec étapes
interface FormStepProps {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormStep: React.FC<FormStepProps> = ({ 
  step, 
  totalSteps, 
  title, 
  description, 
  children, 
  className 
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* En-tête de l'étape */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-semibold">
            {step}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {title}
            </h3>
            <p className="text-sm text-slate-500">
              Étape {step} sur {totalSteps}
            </p>
          </div>
        </div>
        {description && (
          <p className="text-sm text-slate-600 ml-11">
            {description}
          </p>
        )}
      </div>

      {/* Contenu de l'étape */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

// Composant de validation de formulaire
interface FormValidationProps {
  errors: Record<string, string>;
  className?: string;
}

export const FormValidation: React.FC<FormValidationProps> = ({ 
  errors, 
  className 
}) => {
  if (Object.keys(errors).length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {Object.entries(errors).map(([field, message]) => (
        <div 
          key={field}
          className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{field}:</strong> {message}
          </span>
        </div>
      ))}
    </div>
  );
};
