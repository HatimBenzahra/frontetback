import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui-admin/tooltip';
import { Edit, Trash2, MapPin, User, Users, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ImmeubleCardProps } from '../../types/types';

const ImmeubleCard: React.FC<ImmeubleCardProps & { index: number }> = ({
    immeuble,
    index,
    onOpenDetailsModal,
    onOpenEditModal,
    onDelete,
    getProspectingStatus,
    getBuildingDetails
}) => {
    const status = getProspectingStatus(immeuble);
    const StatusIcon = status.icon;

    return (
        <motion.div
            key={immeuble.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="w-full h-full"
        >
            <Card 
                className="flex flex-col h-full rounded-2xl bg-white text-card-foreground shadow-sm border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                onClick={() => onOpenDetailsModal(immeuble)}
            >
                <CardHeader className="pb-3 px-5 pt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5", status.className)}>
                            <StatusIcon className={cn("h-3.5 w-3.5", status.key === 'EN_COURS' && 'animate-spin')} />
                            {status.label}
                        </span>
                        <div className="flex items-center gap-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-full hover:bg-slate-100" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                onOpenEditModal(immeuble);
                                            }}
                                        >
                                            <Edit className="h-4 w-4 text-slate-500" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Modifier</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                onDelete(immeuble.id);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Supprimer</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                    <CardTitle className="text-md font-bold break-words text-slate-800">{immeuble.adresse}</CardTitle>
                    <CardDescription className="text-sm text-slate-500 flex items-center gap-2 pt-1">
                        <MapPin className="h-4 w-4" />
                        {immeuble.ville}, {immeuble.codePostal}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground flex-grow space-y-3 px-5 pb-4 pt-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="font-semibold text-slate-800 text-base">{getBuildingDetails(immeuble).nbEtages}</p>
                            <p className="text-xs text-slate-500">Étages</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="font-semibold text-slate-800 text-base">{immeuble.nbPortesTotal}</p>
                            <p className="text-xs text-slate-500">Portes</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="font-semibold text-slate-800 text-base">{immeuble.hasElevator ? 'Oui' : 'Non'}</p>
                            <p className="text-xs text-slate-500">Ascenseur</p>
                        </div>
                    </div>
                    {status.key !== 'NON_CONFIGURE' && immeuble.prospectingMode && (
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                            <span className="font-semibold text-slate-600 flex items-center gap-2">
                                {immeuble.prospectingMode === 'SOLO' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                Mode
                            </span>
                            <span className="font-bold text-slate-800">{immeuble.prospectingMode}</span>
                        </div>
                    )}
                    {immeuble.digicode && (
                        <div className="flex items-center justify-between p-2.5 bg-red-50 rounded-lg">
                            <span className="font-semibold text-red-600 flex items-center gap-2">
                                <KeyRound className="h-4 w-4" />Digicode
                            </span>
                            <span className="font-bold text-red-800">{immeuble.digicode}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default ImmeubleCard;