import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui-admin/dialog';
import { Button } from '@/components/ui-admin/button';
import { ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { statusConfig } from '../../pages/commercial/prospection/doors-config';
import { type ImmeubleDetailsModalProps, type PorteWithEtage } from '../../types/types';

const ImmeubleDetailsModal: React.FC<ImmeubleDetailsModalProps> = ({
    isOpen,
    onClose,
    selectedImmeuble,
    getProspectingStatus,
    onGoToProspecting
}) => {
    if (!selectedImmeuble) return null;

    const status = getProspectingStatus(selectedImmeuble);

    const portesByFloor = useMemo(() => {
        const grouped: { [key: string]: PorteWithEtage[] } = {};
        if (!selectedImmeuble.portes) return grouped;
        for (const porte of selectedImmeuble.portes) {
            const floor = (porte as any).etage || 'N/A';
            if (!grouped[floor]) {
                grouped[floor] = [];
            }
            grouped[floor].push(porte as PorteWithEtage);
        }
        return grouped;
    }, [selectedImmeuble]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl bg-white rounded-2xl">
                <DialogHeader className="p-6">
                    <DialogTitle className="text-2xl font-bold text-slate-800">{selectedImmeuble.adresse}</DialogTitle>
                    <DialogDescription>{selectedImmeuble.ville}, {selectedImmeuble.codePostal}</DialogDescription>
                </DialogHeader>
                
                <div className="py-4 max-h-[60vh] overflow-y-auto px-6">
                    {status.key === 'NON_CONFIGURE' ? (
                        <div className="text-center p-8 bg-slate-50 rounded-lg">
                            <Info className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700">Immeuble non configuré</h3>
                            <p className="text-slate-500 mt-1">Vous devez configurer cet immeuble avant de pouvoir commencer la prospection.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.keys(portesByFloor).sort((a,b) => Number(a) - Number(b)).map(floor => (
                                <div key={floor}>
                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-2">Étage {floor}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
                                        {portesByFloor[floor].map(porte => {
                                            const config = statusConfig[porte.statut as keyof typeof statusConfig];
                                            return (
                                                <div key={porte.id} className={cn("p-2 rounded-md text-sm", config?.badgeClassName)}>
                                                    <p className="font-semibold">{porte.numeroPorte}</p>
                                                    <p className="capitalize">{config?.label || porte.statut.toLowerCase().replace('_', ' ')}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                    <Button variant="outline" onClick={onClose}>Fermer</Button>
                    <Button onClick={onGoToProspecting} className="bg-blue-600 text-white hover:bg-blue-700">
                        {status.key === 'NON_CONFIGURE' ? 'Configurer la prospection' : 'Passer à la prospection'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ImmeubleDetailsModal;