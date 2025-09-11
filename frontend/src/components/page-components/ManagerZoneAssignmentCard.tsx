import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';

import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-admin/popover';
import { Calendar } from '@/components/ui-admin/calendar';
import { Slider } from '@/components/ui-admin/slider';
import { MapPin, Loader2, Calendar as CalendarIcon, Users, Shield, Target, Clock, CheckCircle2, Search, Edit3, Save } from 'lucide-react';
import { fr } from 'date-fns/locale';
import { startOfToday } from 'date-fns';
import { AssignmentType } from '@/types/enums';
import type { Commercial, Zone } from '@/types/types';
import { managerAssignmentGoalsService } from '@/services/manager-assignment-goals.service';

interface ManagerZoneAssignmentCardProps {
  zones: Zone[];
  commercials: Commercial[];
  equipes: any[];
  onAssign: (
    zoneId: string,
    assigneeId: string,
    assigneeType: AssignmentType,
    startDate?: string,
    durationDays?: number,
  ) => Promise<void>;
  onZoneSelect: (zoneId: string) => void;
}

export const ManagerZoneAssignmentCard = ({ zones, commercials, equipes, onAssign, onZoneSelect }: ManagerZoneAssignmentCardProps) => {
  const [selectedZone, setSelectedZone] = useState('');
  const [assigneeType, setAssigneeType] = useState<AssignmentType>(AssignmentType.COMMERCIAL);
  const [assigneeId, setAssigneeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [durationDays, setDurationDays] = useState<number | string>(30);
  const [startDate, setStartDate] = useState<Date | undefined>(startOfToday());
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [tempDuration, setTempDuration] = useState<string>(durationDays.toString());
  
  // États pour la recherche
  const [zoneSearchTerm, setZoneSearchTerm] = useState('');
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
  const [showZoneResults, setShowZoneResults] = useState(false);
  const [showAssigneeResults, setShowAssigneeResults] = useState(false);
  
  // États pour les commerciaux qui seront assignés automatiquement
  const [affectedCommercials, setAffectedCommercials] = useState<Commercial[]>([]);
  const [loadingAffectedCommercials, setLoadingAffectedCommercials] = useState(false);
  
  // Refs pour détecter les clics en dehors
  const zoneSearchRef = useRef<HTMLDivElement>(null);
  const assigneeSearchRef = useRef<HTMLDivElement>(null);
  
  // Date minimale (aujourd'hui)
  const today = startOfToday();
  const disabledDays = { before: today };

  // Pour les managers, on ne peut assigner qu'aux commerciaux et équipes
  const assigneeOptions = assigneeType === AssignmentType.COMMERCIAL 
    ? commercials 
    : equipes; // Pas de managers dans l'espace manager

  // Filtrage des options basé sur la recherche
  const filteredZones = useMemo(() => {
    if (!zoneSearchTerm) return zones;
    return zones.filter(zone => 
      zone.name.toLowerCase().includes(zoneSearchTerm.toLowerCase())
    );
  }, [zones, zoneSearchTerm]);

  const filteredAssigneeOptions = useMemo(() => {
    if (!assigneeSearchTerm) return assigneeOptions;
    return assigneeOptions.filter(option => {
      if (assigneeType === AssignmentType.EQUIPE) {
        return (option as any).nom.toLowerCase().includes(assigneeSearchTerm.toLowerCase());
      } else {
        const person = option as Commercial;
        return `${person.prenom} ${person.nom}`.toLowerCase().includes(assigneeSearchTerm.toLowerCase());
      }
    });
  }, [assigneeOptions, assigneeSearchTerm, assigneeType]);

  const isFormValid = selectedZone && assigneeId && assigneeType && (typeof durationDays === 'number' && durationDays > 0);

  // Fonction pour gérer la modification manuelle de la durée
  const handleDurationEdit = () => {
    if (isEditingDuration) {
      const newDuration = parseInt(tempDuration);
      if (!isNaN(newDuration) && newDuration > 0) {
        setDurationDays(newDuration);
      }
    }
    setIsEditingDuration(!isEditingDuration);
  };

  // Fonction pour récupérer les commerciaux qui seront affectés
  const fetchAffectedCommercials = async (assigneeId: string, assigneeType: AssignmentType) => {
    if (assigneeType === AssignmentType.COMMERCIAL) {
      setAffectedCommercials([]);
      return;
    }

    setLoadingAffectedCommercials(true);
    try {
      let commercials: Commercial[] = [];
      if (assigneeType === AssignmentType.EQUIPE) {
        commercials = await managerAssignmentGoalsService.getCommercialsForEquipe(assigneeId);
      }
      setAffectedCommercials(commercials);
    } catch (error) {
      console.error('Erreur lors de la récupération des commerciaux affectés:', error);
      setAffectedCommercials([]);
    } finally {
      setLoadingAffectedCommercials(false);
    }
  };

  // Fonction pour valider la saisie manuelle
  const validateDurationInput = (value: string) => {
    const num = parseInt(value);
    return !isNaN(num) && num > 0 && num <= 365;
  };

  // Fonction pour gérer le changement de zone
  const handleZoneChange = (zoneId: string) => {
    setSelectedZone(zoneId);
    setZoneSearchTerm(zones.find(z => z.id === zoneId)?.name || '');
    setShowZoneResults(false);
    onZoneSelect(zoneId);
  };

  // Fonction pour gérer le changement de type d'assignation
  const handleTypeChange = (type: AssignmentType) => {
    setAssigneeType(type);
    setAssigneeId('');
    setAssigneeSearchTerm('');
    setAffectedCommercials([]);
  };

  // Fonction pour gérer le changement d'assigné
  const handleAssigneeChange = (id: string) => {
    setAssigneeId(id);
    const option = assigneeOptions.find(opt => opt.id === id);
    if (option) {
      if (assigneeType === AssignmentType.EQUIPE) {
        setAssigneeSearchTerm((option as any).nom);
      } else {
        const person = option as Commercial;
        setAssigneeSearchTerm(`${person.prenom} ${person.nom}`);
      }
    }
    setShowAssigneeResults(false);
    
    // Récupérer les commerciaux affectés
    fetchAffectedCommercials(id, assigneeType);
  };

  // Fonction pour soumettre l'assignation
  const handleSubmit = async () => {
    if (!isFormValid) return;
    
    setIsSubmitting(true);
    try {
      await onAssign(
        selectedZone,
        assigneeId,
        assigneeType,
        startDate?.toISOString(),
        typeof durationDays === 'number' ? durationDays : parseInt(String(durationDays))
      );
      
      // Reset form
      setSelectedZone('');
      setAssigneeId('');
      setAssigneeType(AssignmentType.COMMERCIAL);
      setZoneSearchTerm('');
      setAssigneeSearchTerm('');
      setDurationDays(30);
      setStartDate(startOfToday());
      setAffectedCommercials([]);
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gestion des clics en dehors pour fermer les dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (zoneSearchRef.current && !zoneSearchRef.current.contains(event.target as Node)) {
        setShowZoneResults(false);
      }
      if (assigneeSearchRef.current && !assigneeSearchRef.current.contains(event.target as Node)) {
        setShowAssigneeResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl border-0 bg-gradient-to-br from-white via-blue-50/30 to-white">
      <CardHeader className="pb-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
        <CardTitle className="text-xl font-bold flex items-center">
          <Target className="h-6 w-6 mr-3" />
          Assignation de Zone
        </CardTitle>
        <p className="text-blue-100 text-sm mt-2">
          Assignez une zone à un commercial ou une équipe
        </p>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Sélecteur de Zone */}
        <div className="space-y-4" ref={zoneSearchRef}>
            <label className="text-sm font-bold text-gray-800 flex items-center">
              <MapPin className="h-5 w-5 mr-3 text-blue-600" />
              Zone à assigner
            </label>
            
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une zone..."
                  value={zoneSearchTerm}
                  onChange={(e) => {
                    setZoneSearchTerm(e.target.value);
                    setShowZoneResults(true);
                  }}
                  onFocus={() => setShowZoneResults(true)}
                  className={`w-full h-12 pl-10 pr-4 border-2 rounded-xl backdrop-blur-sm transition-all duration-200 ${
                    selectedZone && zoneSearchTerm 
                      ? 'border-green-500 bg-green-50/80 focus:border-green-600 focus:ring-2 focus:ring-green-500/20 text-green-900 font-medium' 
                      : 'border-blue-200 bg-white/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                {selectedZone && zoneSearchTerm && (
                  <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
                )}
              </div>
              {showZoneResults && (
                <div className="max-h-[300px] overflow-y-auto bg-white/95 backdrop-blur-sm border border-blue-200 rounded-xl shadow-xl">
                  {filteredZones.length > 0 ? (
                    filteredZones.map(z => (
                      <button
                        key={z.id}
                        onClick={() => {
                          handleZoneChange(z.id);
                        }}
                        className="w-full p-3 hover:bg-blue-50 focus:bg-blue-100 transition-colors text-left border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full mr-3 shadow-sm" style={{ backgroundColor: z.color || '#3b82f6' }}></div>
                          <span className="font-medium text-gray-900">{z.name}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      Aucune zone trouvée
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* Sélecteur de Type (Commercial/Équipe seulement) */}
        <div className="space-y-4">
            <label className="text-sm font-bold text-gray-800 flex items-center">
              <Shield className="h-5 w-5 mr-3 text-blue-600" />
              Type d'assignation
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: AssignmentType.COMMERCIAL, label: 'Commercial', icon: Users, color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-500', textColor: 'text-blue-700' },
                { type: AssignmentType.EQUIPE, label: 'Équipe', icon: Shield, color: 'emerald', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-500', textColor: 'text-emerald-700' }
              ].map(({ type, label, icon: Icon, bgColor, borderColor, textColor }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 font-semibold text-sm relative overflow-hidden group ${
                    assigneeType === type
                      ? `${borderColor} ${bgColor} ${textColor} shadow-lg scale-105`
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:scale-102'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`p-2 rounded-lg transition-colors ${
                      assigneeType === type ? 'bg-white/80' : 'bg-gray-100 group-hover:bg-gray-200'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        assigneeType === type ? textColor : 'text-gray-500'
                      }`} />
                    </div>
                    <span>{label}</span>
                    {assigneeType === type && (
                      <CheckCircle2 className="h-4 w-4 absolute top-2 right-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
        </div>

        {/* Sélecteur de Personne */}
        <div className="space-y-4" ref={assigneeSearchRef}>
            <label className="text-sm font-bold text-gray-800 flex items-center">
              <Users className="h-5 w-5 mr-3 text-blue-600" />
              Sélectionner {assigneeType === AssignmentType.COMMERCIAL ? 'le commercial' : 'l\'équipe'}
            </label>
            
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Rechercher ${assigneeType === AssignmentType.COMMERCIAL ? 'un commercial' : 'une équipe'}...`}
                  value={assigneeSearchTerm}
                  onChange={(e) => {
                    setAssigneeSearchTerm(e.target.value);
                    setShowAssigneeResults(true);
                  }}
                  onFocus={() => setShowAssigneeResults(true)}
                  className={`w-full h-12 pl-10 pr-4 border-2 rounded-xl backdrop-blur-sm transition-all duration-200 ${
                    assigneeId && assigneeSearchTerm 
                      ? 'border-green-500 bg-green-50/80 focus:border-green-600 focus:ring-2 focus:ring-green-500/20 text-green-900 font-medium' 
                      : 'border-blue-200 bg-white/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                {assigneeId && assigneeSearchTerm && (
                  <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
                )}
              </div>
              {showAssigneeResults && (
                <div className="max-h-[300px] overflow-y-auto bg-white/95 backdrop-blur-sm border border-blue-200 rounded-xl shadow-xl">
                  {filteredAssigneeOptions.length > 0 ? (
                    filteredAssigneeOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => handleAssigneeChange(option.id)}
                        className="w-full p-3 hover:bg-blue-50 focus:bg-blue-100 transition-colors text-left border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold mr-3">
                            {assigneeType === AssignmentType.EQUIPE 
                              ? (option as any).nom.charAt(0).toUpperCase()
                              : `${(option as Commercial).prenom.charAt(0)}${(option as Commercial).nom.charAt(0)}`
                            }
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {assigneeType === AssignmentType.EQUIPE 
                                ? (option as any).nom
                                : `${(option as Commercial).prenom} ${(option as Commercial).nom}`
                              }
                            </div>
                            <div className="text-sm text-gray-500">
                              {assigneeType === AssignmentType.EQUIPE ? 'Équipe' : 'Commercial'}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      Aucun {assigneeType === AssignmentType.COMMERCIAL ? 'commercial' : 'équipe'} trouvé
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* Affichage des commerciaux affectés */}
        {affectedCommercials.length > 0 && (
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-800 flex items-center">
              <Users className="h-5 w-5 mr-3 text-green-600" />
              Commerciaux affectés ({affectedCommercials.length})
            </label>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              {loadingAffectedCommercials ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-green-600 mr-2" />
                  <span className="text-green-700">Chargement...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {affectedCommercials.map(commercial => (
                    <div key={commercial.id} className="flex items-center text-sm">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold mr-2">
                        {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                      </div>
                      <span className="text-green-800 font-medium">
                        {commercial.prenom} {commercial.nom}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configuration de la durée */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-800 flex items-center">
            <Clock className="h-5 w-5 mr-3 text-blue-600" />
            Durée de l'assignation
          </label>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Slider
                  value={[typeof durationDays === 'number' ? durationDays : parseInt(durationDays.toString())]}
                  onValueChange={(value) => setDurationDays(value[0])}
                  max={365}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="flex items-center space-x-2">
                {isEditingDuration ? (
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={tempDuration}
                      onChange={(e) => setTempDuration(e.target.value)}
                      className="w-20 h-8 text-center"
                      min="1"
                      max="365"
                    />
                    <Button
                      size="sm"
                      onClick={handleDurationEdit}
                      disabled={!validateDurationInput(tempDuration)}
                      className="h-8 px-2"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-blue-700 min-w-[3rem] text-center">
                      {typeof durationDays === 'number' ? durationDays : parseInt(durationDays.toString())}
                    </span>
                    <span className="text-sm text-gray-600">jours</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDurationEdit}
                      className="h-8 px-2"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>1 jour</span>
              <span>365 jours</span>
            </div>
          </div>
        </div>

        {/* Date de début (optionnelle) */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-800 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-3 text-blue-600" />
            Date de début (optionnelle)
          </label>
          
          <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal h-12 ${
                  startDate ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? startDate.toLocaleDateString('fr-FR') : 'Sélectionner une date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={disabledDays}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Bouton de soumission */}
        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-lg rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Assignation en cours...
              </>
            ) : (
              <>
                <Target className="mr-2 h-5 w-5" />
                Assigner la Zone
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
