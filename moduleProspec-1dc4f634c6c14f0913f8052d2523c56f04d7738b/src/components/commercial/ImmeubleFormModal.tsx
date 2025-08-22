import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui-admin/dialog';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';
import AddressInput from '@/components/ui-admin/AddressInput';
import { 
    Loader2, 
    ArrowRight, 
    ArrowLeft, 
    Plus, 
    Minus, 
    XCircle, 
    ArrowUpDown, 
    MapPin, 
    Building, 
    Hash, 
    CheckCircle,
    AlertCircle,
    Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ImmeubleFormModalProps } from '../../types/types';

// Types pour la validation
interface FormErrors {
    adresse?: string;
    ville?: string;
    codePostal?: string;
    digicode?: string;
    nbEtages?: string;
    nbPortesParEtage?: string;
}

const ImmeubleFormModal: React.FC<ImmeubleFormModalProps> = ({
    isOpen,
    onClose,
    editingImmeuble,
    formState,
    onFormChange,
    onSubmit,
    isSubmitting,
    formStep,
    onNextStep,
    onPrevStep,
    setFormState
}) => {
    const [errors, setErrors] = useState<FormErrors>({});
    const [isValidating, setIsValidating] = useState(false);

    // Réinitialiser les erreurs quand le modal s'ouvre
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            // Initialiser les valeurs par défaut si elles ne sont pas définies
            if (!editingImmeuble) {
                setFormState(prev => ({
                    ...prev,
                    nbEtages: prev.nbEtages || 1,
                    nbPortesParEtage: prev.nbPortesParEtage || 1
                }));
            }
        }
    }, [isOpen, editingImmeuble]);

    // Validation des champs
    const validateStep1 = (): boolean => {
        const newErrors: FormErrors = {};
        
        if (!formState.adresse?.trim()) {
            newErrors.adresse = "L'adresse est requise";
        }
        
        if (!formState.ville?.trim()) {
            newErrors.ville = "La ville est requise";
        } else if (formState.ville.length < 2) {
            newErrors.ville = "La ville doit contenir au moins 2 caractères";
        }
        
        if (!formState.codePostal?.trim()) {
            newErrors.codePostal = "Le code postal est requis";
        } else if (!/^\d{5}$/.test(formState.codePostal)) {
            newErrors.codePostal = "Le code postal doit contenir 5 chiffres";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = (): boolean => {
        const newErrors: FormErrors = {};
        
        if (!editingImmeuble) {
            // Utiliser les valeurs avec fallback pour la validation
            const nbEtages = formState.nbEtages || 1;
            const nbPortesParEtage = formState.nbPortesParEtage || 1;
            
            if (nbEtages < 1) {
                newErrors.nbEtages = "Le nombre d'étages doit être au moins 1";
            }
            
            if (nbPortesParEtage < 1) {
                newErrors.nbPortesParEtage = "Le nombre de portes par étage doit être au moins 1";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Gestionnaire pour passer à l'étape suivante avec validation
    const handleNextStep = async () => {
        setIsValidating(true);
        
        if (formStep === 1) {
            if (validateStep1()) {
                onNextStep();
            }
        }
        
        setIsValidating(false);
    };

    // Gestionnaire pour soumettre le formulaire avec validation
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsValidating(true);
        
        if (validateStep2()) {
            onSubmit(e);
        }
        
        setIsValidating(false);
    };

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { 
            opacity: 1, 
            scale: 1,
            transition: {
                duration: 0.3,
                ease: "easeOut"
            }
        },
        exit: { 
            opacity: 0, 
            scale: 0.95,
            transition: {
                duration: 0.2,
                ease: "easeIn"
            }
        }
    };

    const stepVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 300 : -300,
            opacity: 0
        })
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-2xl bg-white rounded-3xl max-h-[95vh] flex flex-col p-0 gap-0 shadow-2xl border-0">
                <DialogHeader className="px-6 sm:px-8 pt-6 sm:pt-8 text-center shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
                    <DialogTitle className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center justify-center gap-3">
                        <Building className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                        {editingImmeuble ? "Modifier l'immeuble" : "Ajouter un nouvel immeuble"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-600 text-base sm:text-lg mt-2">
                        {formStep === 1
                            ? "Commencez par l'adresse de l'immeuble."
                            : "Ajoutez les détails de l'immeuble."}
                    </DialogDescription>
                </DialogHeader>

                {/* Barre de progression améliorée */}
                <div className="px-6 sm:px-8 py-4 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <span className={cn(
                            "text-sm font-medium transition-colors",
                            formStep >= 1 ? "text-blue-600" : "text-slate-400"
                        )}>
                            Étape 1: Adresse
                        </span>
                        <span className={cn(
                            "text-sm font-medium transition-colors",
                            formStep >= 2 ? "text-blue-600" : "text-slate-400"
                        )}>
                            Étape 2: Détails
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full shadow-sm"
                            initial={{ width: "0%" }}
                            animate={{ width: formStep === 1 ? "50%" : "100%" }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                </div>

                {/* Contenu scrollable */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <AnimatePresence mode="wait" custom={formStep}>
                        {formStep === 1 && (
                            <motion.div
                                key="step1"
                                custom={1}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{
                                    x: { type: "spring", stiffness: 300, damping: 30 },
                                    opacity: { duration: 0.2 }
                                }}
                                className="grid gap-4 sm:gap-6 p-6 sm:p-8"
                            >
                                {/* Adresse */}
                                <div className="space-y-3">
                                    <Label htmlFor="adresse" className="text-base font-semibold text-slate-700 flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        Adresse complète
                                    </Label>
                                    <AddressInput
                                        initialValue={formState.adresse}
                                        onSelect={(selection) => {
                                            setFormState((prev) => ({
                                                ...prev,
                                                adresse: selection.address,
                                                ville: selection.city,
                                                codePostal: selection.postalCode,
                                                latitude: selection.latitude,
                                                longitude: selection.longitude,
                                            }));
                                            // Effacer l'erreur d'adresse si elle existe
                                            if (errors.adresse) {
                                                setErrors(prev => ({ ...prev, adresse: undefined }));
                                            }
                                        }}
                                    />
                                    {errors.adresse && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200"
                                        >
                                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                            {errors.adresse}
                                        </motion.div>
                                    )}
                                </div>

                                {/* Ville et Code Postal */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="ville" className="text-base font-semibold text-slate-700">
                                            Ville
                                        </Label>
                                        <div className="relative">
                                            <Input 
                                                id="ville" 
                                                name="ville" 
                                                value={formState.ville} 
                                                onChange={(e) => {
                                                    onFormChange(e);
                                                    if (errors.ville) {
                                                        setErrors(prev => ({ ...prev, ville: undefined }));
                                                    }
                                                }}
                                                placeholder="Ex : Paris" 
                                                className={cn(
                                                    "h-12 text-base rounded-xl transition-all duration-200",
                                                    "border-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
                                                    errors.ville ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-slate-200"
                                                )}
                                                required 
                                            />
                                            {formState.ville && !errors.ville && (
                                                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                                            )}
                                        </div>
                                        {errors.ville && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex items-center gap-2 text-red-600 text-sm"
                                            >
                                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                {errors.ville}
                                            </motion.div>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <Label htmlFor="codePostal" className="text-base font-semibold text-slate-700">
                                            Code Postal
                                        </Label>
                                        <div className="relative">
                                            <Input 
                                                id="codePostal" 
                                                name="codePostal" 
                                                value={formState.codePostal} 
                                                onChange={(e) => {
                                                    onFormChange(e);
                                                    if (errors.codePostal) {
                                                        setErrors(prev => ({ ...prev, codePostal: undefined }));
                                                    }
                                                }}
                                                placeholder="Ex : 75001" 
                                                className={cn(
                                                    "h-12 text-base rounded-xl transition-all duration-200",
                                                    "border-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
                                                    errors.codePostal ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-slate-200"
                                                )}
                                                required 
                                            />
                                            {formState.codePostal && !errors.codePostal && (
                                                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                                            )}
                                        </div>
                                        {errors.codePostal && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex items-center gap-2 text-red-600 text-sm"
                                            >
                                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                {errors.codePostal}
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                {/* Info box */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3"
                                >
                                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-800">
                                        <p className="font-medium mb-1">Conseil</p>
                                        <p>Assurez-vous que l'adresse est correcte. Elle sera utilisée pour localiser l'immeuble sur la carte.</p>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}

                        {formStep === 2 && (
                            <form key="step2" onSubmit={handleSubmit}>
                                <motion.div
                                    custom={2}
                                    variants={stepVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{
                                        x: { type: "spring", stiffness: 300, damping: 30 },
                                        opacity: { duration: 0.2 }
                                    }}
                                    className="grid gap-4 sm:gap-6 p-6 sm:p-8"
                                >
                                    {!editingImmeuble && (
                                        <div className="space-y-6">
                                            {/* Nombre d'étages */}
                                            <div className="space-y-4">
                                                <Label className="text-base font-semibold text-slate-700 flex items-center gap-2">
                                                    <Building className="h-4 w-4 text-blue-500" />
                                                    Nombre d'étages
                                                </Label>
                                                <div className="flex items-center justify-center space-x-4 p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-12 w-12 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm"
                                                        onClick={() => setFormState(prev => ({ ...prev, nbEtages: Math.max(1, (prev.nbEtages || 1) - 1) }))}
                                                        disabled={(formState.nbEtages || 1) <= 1}
                                                    >
                                                        <Minus className="h-5 w-5" />
                                                    </Button>
                                                    <div className="bg-white border-2 border-slate-200 rounded-xl px-6 py-4 min-w-[100px] text-center shadow-sm">
                                                        <span className="text-3xl font-bold text-slate-800">{formState.nbEtages || 1}</span>
                                                        <p className="text-sm text-slate-500 mt-1">étage{(formState.nbEtages || 1) > 1 ? 's' : ''}</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-12 w-12 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm"
                                                        onClick={() => setFormState(prev => ({ ...prev, nbEtages: Math.min(50, (prev.nbEtages || 1) + 1) }))}
                                                        disabled={(formState.nbEtages || 1) >= 50}
                                                    >
                                                        <Plus className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                                {errors.nbEtages && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="flex items-center gap-2 text-red-600 text-sm"
                                                    >
                                                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                        {errors.nbEtages}
                                                    </motion.div>
                                                )}
                                            </div>
                                            
                                            {/* Portes par étage */}
                                            <div className="space-y-4">
                                                <Label className="text-base font-semibold text-slate-700 flex items-center gap-2">
                                                    <Hash className="h-4 w-4 text-blue-500" />
                                                    Portes par étage
                                                </Label>
                                                <div className="flex items-center justify-center space-x-4 p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-12 w-12 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm"
                                                        onClick={() => setFormState(prev => ({ ...prev, nbPortesParEtage: Math.max(1, (prev.nbPortesParEtage || 1) - 1) }))}
                                                        disabled={(formState.nbPortesParEtage || 1) <= 1}
                                                    >
                                                        <Minus className="h-5 w-5" />
                                                    </Button>
                                                    <div className="bg-white border-2 border-slate-200 rounded-xl px-6 py-4 min-w-[100px] text-center shadow-sm">
                                                        <span className="text-3xl font-bold text-slate-800">{formState.nbPortesParEtage || 1}</span>
                                                        <p className="text-sm text-slate-500 mt-1">porte{(formState.nbPortesParEtage || 1) > 1 ? 's' : ''}</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-12 w-12 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm"
                                                        onClick={() => setFormState(prev => ({ ...prev, nbPortesParEtage: Math.min(20, (prev.nbPortesParEtage || 1) + 1) }))}
                                                        disabled={(formState.nbPortesParEtage || 1) >= 20}
                                                    >
                                                        <Plus className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                                {errors.nbPortesParEtage && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="flex items-center gap-2 text-red-600 text-sm"
                                                    >
                                                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                        {errors.nbPortesParEtage}
                                                    </motion.div>
                                                )}
                                            </div>
                                            
                                            {/* Résumé total */}
                                            {formState.nbEtages && formState.nbPortesParEtage && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white text-center shadow-lg"
                                                >
                                                    <p className="text-sm font-medium opacity-90">Total des portes</p>
                                                    <p className="text-2xl font-bold mt-1">
                                                        {formState.nbEtages * formState.nbPortesParEtage} portes
                                                    </p>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Autres détails */}
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            <Label htmlFor="digicode" className="text-base font-semibold text-slate-700">
                                                Digicode (optionnel)
                                            </Label>
                                            <Input 
                                                id="digicode" 
                                                name="digicode" 
                                                value={formState.digicode} 
                                                onChange={onFormChange} 
                                                placeholder="Entrez le digicode" 
                                                className="h-12 text-base rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                                            />
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <Label className="text-base font-semibold text-slate-700">
                                                Ascenseur
                                            </Label>
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                <div className="flex items-center justify-center space-x-4">
                                                    <Button
                                                        type="button"
                                                        variant={!formState.hasElevator ? "default" : "outline"}
                                                        className={cn(
                                                            "h-12 px-6 rounded-xl font-semibold transition-all duration-200 flex-1",
                                                            !formState.hasElevator 
                                                                ? "bg-slate-600 text-white hover:bg-slate-700 shadow-md" 
                                                                : "border-2 border-slate-300 hover:border-slate-400"
                                                        )}
                                                        onClick={() => setFormState(prev => ({ ...prev, hasElevator: false }))}
                                                    >
                                                        <XCircle className="mr-2 h-5 w-5" />
                                                        Non
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={formState.hasElevator ? "default" : "outline"}
                                                        className={cn(
                                                            "h-12 px-6 rounded-xl font-semibold transition-all duration-200 flex-1",
                                                            formState.hasElevator 
                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" 
                                                                : "border-2 border-slate-300 hover:border-slate-400"
                                                        )}
                                                        onClick={() => setFormState(prev => ({ ...prev, hasElevator: true }))}
                                                    >
                                                        <ArrowUpDown className="mr-2 h-5 w-5" />
                                                        Oui
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </form>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer amélioré */}
                <div className="shrink-0 p-6 sm:p-8 pt-4 flex justify-between w-full gap-4 bg-gradient-to-r from-slate-50 to-blue-50 border-t border-slate-200 rounded-b-3xl">
                    {formStep === 1 ? (
                        <>
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={onClose}
                                className="h-12 px-6 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 hover:border-slate-400 flex-1 sm:flex-none"
                            >
                                Annuler
                            </Button>
                            <Button 
                                type="button" 
                                onClick={handleNextStep}
                                disabled={isValidating}
                                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 h-12 px-6 rounded-xl font-semibold transition-all duration-200 shadow-md flex-1 sm:flex-none"
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Validation...
                                    </>
                                ) : (
                                    <>
                                        Suivant
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={onPrevStep} 
                                className="flex items-center gap-2 h-12 px-6 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 hover:border-slate-400 flex-1 sm:flex-none"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Précédent
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting || isValidating} 
                                onClick={formStep === 2 ? handleSubmit : undefined}
                                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 h-12 px-6 rounded-xl font-semibold transition-all duration-200 shadow-md flex-1 sm:flex-none"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {editingImmeuble ? "Mise à jour..." : "Création..."}
                                    </>
                                ) : (
                                    <>
                                        {editingImmeuble ? "Mettre à jour" : "Créer l'immeuble"}
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ImmeubleFormModal;