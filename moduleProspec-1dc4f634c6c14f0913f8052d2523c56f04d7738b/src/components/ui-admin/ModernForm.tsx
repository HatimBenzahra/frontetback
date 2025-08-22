import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { FormField, FormSection, FormStep, FormValidation } from './FormField';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Loader2
} from 'lucide-react';

interface FormStepConfig {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldConfig[];
  validation?: (data: any) => Record<string, string>;
}

interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select' | 'checkbox' | 'radio';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  icon?: React.ReactNode;
  options?: { value: string; label: string }[];
  validation?: (value: any) => string | undefined;
}

interface ModernFormProps {
  steps: FormStepConfig[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  className?: string;
  showProgress?: boolean;
  allowStepNavigation?: boolean;
}

export const ModernForm: React.FC<ModernFormProps> = ({
  steps,
  initialData = {},
  onSubmit,
  onCancel,
  submitText = "Soumettre",
  cancelText = "Annuler",
  loading = false,
  className,
  showProgress = true,
  allowStepNavigation = true
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepConfig = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Validation d'une étape
  const validateStep = useCallback((stepIndex: number): boolean => {
    const step = steps[stepIndex];
    const stepErrors: Record<string, string> = {};

    // Validation des champs individuels
    step.fields.forEach(field => {
      const value = formData[field.name];
      
      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        stepErrors[field.name] = `${field.label} est requis`;
      } else if (field.validation && value) {
        const fieldError = field.validation(value);
        if (fieldError) {
          stepErrors[field.name] = fieldError;
        }
      }
    });

    // Validation personnalisée de l'étape
    if (step.validation) {
      const stepValidationErrors = step.validation(formData);
      Object.assign(stepErrors, stepValidationErrors);
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }, [steps, formData]);

  // Navigation entre les étapes
  const goToStep = useCallback((stepIndex: number) => {
    if (!allowStepNavigation) return;
    
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex);
      setErrors({});
    }
  }, [steps.length, allowStepNavigation]);

  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      if (isLastStep) {
        handleSubmit();
      } else {
        setCurrentStep(prev => prev + 1);
        setErrors({});
      }
    }
  }, [currentStep, isLastStep, validateStep]);

  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
      setErrors({});
    }
  }, [isFirstStep]);

  // Gestion des changements de champs
  const handleFieldChange = useCallback((name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Effacer l'erreur du champ si elle existe
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  // Soumission du formulaire
  const handleSubmit = useCallback(async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, formData, onSubmit, validateStep]);

  // Rendu d'un champ
  const renderField = useCallback((field: FormFieldConfig) => {
    const value = formData[field.name];
    const error = errors[field.name];

    const commonProps = {
      id: field.name,
      name: field.name,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => 
        handleFieldChange(field.name, e.target.value),
      placeholder: field.placeholder,
      required: field.required,
      error: error,
      hint: field.hint,
      icon: field.icon,
      success: !error && value && field.required,
    };

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.name} className="space-y-2">
            <label htmlFor={field.name} className="text-sm font-semibold text-slate-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              {...commonProps}
              className={cn(
                "w-full h-24 px-3 py-2 border-2 rounded-lg resize-none transition-all duration-200",
                "focus:outline-none focus:ring-4 focus:ring-blue-100",
                error 
                  ? "border-red-300 focus:border-red-500" 
                  : "border-slate-200 focus:border-blue-500"
              )}
            />
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <label htmlFor={field.name} className="text-sm font-semibold text-slate-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              {...commonProps}
              className={cn(
                "w-full h-12 px-3 border-2 rounded-lg transition-all duration-200",
                "focus:outline-none focus:ring-4 focus:ring-blue-100",
                error 
                  ? "border-red-300 focus:border-red-500" 
                  : "border-slate-200 focus:border-blue-500"
              )}
            >
              <option value="">{field.placeholder || 'Sélectionner...'}</option>
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={field.name}
              checked={!!value}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <label htmlFor={field.name} className="text-sm font-medium text-slate-700">
              {field.label}
            </label>
          </div>
        );

      default:
        return (
          <FormField
            key={field.name}
            {...commonProps}
            type={field.type}
          />
        );
    }
  }, [formData, errors, handleFieldChange]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Barre de progression */}
      {showProgress && steps.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-200",
                  index <= currentStep 
                    ? "bg-blue-600 text-white" 
                    : "bg-slate-200 text-slate-500"
                )}>
                  {index < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-16 h-1 mx-2 transition-all duration-200",
                    index < currentStep ? "bg-blue-600" : "bg-slate-200"
                  )} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-800">
              {currentStepConfig.title}
            </h3>
            {currentStepConfig.description && (
              <p className="text-sm text-slate-600 mt-1">
                {currentStepConfig.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Contenu de l'étape */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <FormSection>
            {currentStepConfig.fields.map(renderField)}
          </FormSection>

          {/* Erreurs générales */}
          <FormValidation errors={errors} />
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t border-slate-200">
        <div className="flex items-center gap-3">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading || isSubmitting}
            >
              {cancelText}
            </Button>
          )}
          
          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={loading || isSubmitting}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Précédent
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={loading || isSubmitting}
              loading={isSubmitting}
              loadingText="Soumission..."
              rightIcon={<CheckCircle className="h-4 w-4" />}
            >
              {submitText}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={loading || isSubmitting}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Suivant
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Hook pour la gestion des formulaires
export const useForm = <T extends Record<string, any>>(initialData: T) => {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback((name: keyof T, value: any) => {
    setData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const setFieldError = useCallback((name: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const validate = useCallback((validationRules: Record<keyof T, (value: any) => string | undefined>) => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    
    Object.entries(validationRules).forEach(([field, validator]) => {
      const error = validator(data[field as keyof T]);
      if (error) {
        newErrors[field as keyof T] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data]);

  const reset = useCallback(() => {
    setData(initialData);
    setErrors({});
    setIsSubmitting(false);
  }, [initialData]);

  return {
    data,
    errors,
    isSubmitting,
    setIsSubmitting,
    updateField,
    setFieldError,
    validate,
    reset,
    setData
  };
};
