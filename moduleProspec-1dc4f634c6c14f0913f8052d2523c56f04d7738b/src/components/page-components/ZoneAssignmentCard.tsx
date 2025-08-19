import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';

import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-admin/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui-admin/tooltip';
import { Calendar } from '@/components/ui-admin/calendar';
import { Slider } from '@/components/ui-admin/slider';
import { MapPin, Loader2, Calendar as CalendarIcon, Users, Building, Shield, Target, Clock, CheckCircle2, Search, Edit3, Save } from 'lucide-react';
import { fr } from 'date-fns/locale';
import { startOfToday } from 'date-fns';
import { AssignmentType } from '@/types/enums';
import type { Commercial, Manager, Zone } from '@/types/types';
import type { EquipeFromApi } from '@/services/equipe.service';

interface ZoneAssignmentCardProps {
  zones: Zone[];
  commercials: Commercial[];
  managers: Manager[];
  equipes: EquipeFromApi[];
  onAssign: (
    zoneId: string,
    assigneeId: string,
    assigneeType: AssignmentType,
    startDate?: string,
    durationDays?: number,
  ) => Promise<void>;
  onZoneSelect: (zoneId: string) => void;
}

export const ZoneAssignmentCard = ({ zones, commercials, managers, equipes, onAssign, onZoneSelect }: ZoneAssignmentCardProps) => {
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
  
  // Refs pour détecter les clics en dehors
  const zoneSearchRef = useRef<HTMLDivElement>(null);
  const assigneeSearchRef = useRef<HTMLDivElement>(null);
  
  // Date minimale (aujourd'hui)
  const today = startOfToday();
  const disabledDays = { before: today };

  const assigneeOptions = assigneeType === AssignmentType.COMMERCIAL 
    ? commercials 
    : assigneeType === AssignmentType.MANAGER 
    ? managers 
    : equipes;

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
        return (option as EquipeFromApi).nom.toLowerCase().includes(assigneeSearchTerm.toLowerCase());
      } else {
        const person = option as Commercial | Manager;
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

  // Fonction pour valider la saisie manuelle
  const handleDurationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTempDuration(value);
    
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      setDurationDays(numValue);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    await onAssign(
      selectedZone,
      assigneeId,
      assigneeType,
      startDate ? startDate.toISOString() : undefined,
      durationDays as number,
    );
    setIsSubmitting(false);
  };
  
  const handleZoneChange = (zoneId: string) => {
    setSelectedZone(zoneId);
    onZoneSelect(zoneId);
    setShowZoneResults(false);
    // Afficher le nom de la zone sélectionnée dans la barre de recherche
    const selectedZoneData = zones.find(z => z.id === zoneId);
    setZoneSearchTerm(selectedZoneData ? selectedZoneData.name : '');
  }
  
  const handleTypeChange = (type: AssignmentType) => {
    setAssigneeType(type);
    setAssigneeId(''); // Reset assignee when type changes
    setAssigneeSearchTerm(''); // Reset search term when type changes
  }

  // Gestionnaire de clic en dehors pour fermer les listes
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <TooltipProvider>
      <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white rounded-t-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20"></div>
          <CardTitle className="flex items-center text-white relative z-10">
            <div className="p-3 bg-white/20 rounded-xl mr-4 backdrop-blur-sm border border-white/30">
              <Target className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">Assignation de Zone</div>
              <div className="text-blue-100 text-sm font-medium opacity-90">Gestion des affectations territoriales</div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
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

        {/* Sélecteur de Type (Commercial/Manager/Équipe) */}
        <div className="space-y-4">
            <label className="text-sm font-bold text-gray-800 flex items-center">
              <Shield className="h-5 w-5 mr-3 text-blue-600" />
              Type d'assignation
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: AssignmentType.COMMERCIAL, label: 'Commercial', icon: Users, color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-500', textColor: 'text-blue-700' },
                { type: AssignmentType.MANAGER, label: 'Manager', icon: Building, color: 'purple', bgColor: 'bg-purple-50', borderColor: 'border-purple-500', textColor: 'text-purple-700' },
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
              Sélectionner {assigneeType === AssignmentType.COMMERCIAL ? 'le commercial' : 
               assigneeType === AssignmentType.MANAGER ? 'le manager' : 'l\'équipe'}
            </label>
            
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Rechercher ${assigneeType === AssignmentType.COMMERCIAL ? 'un commercial' : 
                   assigneeType === AssignmentType.MANAGER ? 'un manager' : 'une équipe'}...`}
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
                    filteredAssigneeOptions.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setAssigneeId(p.id);
                          setShowAssigneeResults(false);
                          // Afficher le nom de l'assigné sélectionné dans la barre de recherche
                          if (assigneeType === AssignmentType.EQUIPE) {
                            setAssigneeSearchTerm((p as EquipeFromApi).nom);
                          } else {
                            setAssigneeSearchTerm(`${(p as Commercial | Manager).prenom} ${(p as Commercial | Manager).nom}`);
                          }
                        }}
                        className="w-full p-3 hover:bg-blue-50 focus:bg-blue-100 transition-colors text-left border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full mr-4 flex items-center justify-center text-white text-sm font-bold shadow-md ${
                            assigneeType === AssignmentType.COMMERCIAL ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                            assigneeType === AssignmentType.MANAGER ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 
                            'bg-gradient-to-br from-emerald-500 to-emerald-600'
                          }`}>
                            {assigneeType === AssignmentType.EQUIPE 
                              ? (p as EquipeFromApi).nom.charAt(0).toUpperCase()
                              : `${(p as Commercial | Manager).prenom.charAt(0)}${(p as Commercial | Manager).nom.charAt(0)}`
                            }
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">
                              {assigneeType === AssignmentType.EQUIPE 
                                ? (p as EquipeFromApi).nom 
                                : `${(p as Commercial | Manager).prenom} ${(p as Commercial | Manager).nom}`
                              }
                            </div>
                            <div className="text-sm text-gray-500">
                              {assigneeType === AssignmentType.COMMERCIAL ? 'Commercial' :
                               assigneeType === AssignmentType.MANAGER ? 'Manager' : 'Équipe'}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      Aucun résultat trouvé
                    </div>
                  )}
                </div>
                )}
              </div>
        </div>

        {/* Date de début */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-800 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-3 text-blue-600" />
            Date de début
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-1 text-red-500 text-lg font-bold cursor-help">!</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Par défaut : aujourd'hui</p>
              </TooltipContent>
            </Tooltip>
          </label>
          <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal h-12 border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 bg-white/80 backdrop-blur-sm transition-all duration-200">
                <CalendarIcon className="mr-3 h-5 w-5 text-blue-600" />
                {startDate ? (
                  <span className="font-semibold text-gray-900">{startDate.toLocaleDateString('fr-FR')}</span>
                ) : (
                  <span className="text-gray-500">Choisir une date de début</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-sm border border-blue-200 shadow-xl" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => { setStartDate(date); setIsStartOpen(false); }}
                disabled={disabledDays}
                initialFocus
                locale={fr}
                className="rounded-md border-0"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Durée en jours */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-gray-800 flex items-center">
            <Clock className="h-5 w-5 mr-3 text-blue-600" />
            Durée de l'assignation
          </label>
          
          {/* Affichage de la valeur actuelle avec possibilité de modification */}
          <div className="text-center">
            {isEditingDuration ? (
              <div className="flex items-center justify-center gap-2 mb-2">
                <Input
                  type="number"
                  value={tempDuration}
                  onChange={handleDurationInputChange}
                  className="text-3xl font-bold text-blue-700 text-center w-24 h-14 border-2 border-blue-300 focus:border-blue-500"
                  min="1"
                  max="365"
                  autoFocus
                />
                <button
                  onClick={handleDurationEdit}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Save className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mb-2">
                <div 
                  className="text-3xl font-bold text-blue-700 cursor-pointer hover:text-blue-800 transition-colors" 
                  onClick={handleDurationEdit}
                >
                  {typeof durationDays === 'number' ? durationDays : 30}
                </div>
                <button
                  onClick={handleDurationEdit}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="text-sm text-blue-600 font-medium">
              {typeof durationDays === 'number' && durationDays === 1 ? 'jour' : 'jours'}
            </div>
          </div>
          
          {/* Slider */}
          <div className="px-4">
            <Slider
              value={[typeof durationDays === 'number' ? durationDays : 30]}
              onValueChange={(value) => {
                setDurationDays(value[0]);
                setTempDuration(value[0].toString());
              }}
              max={365}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>1j</span>
              <span>30j</span>
              <span>90j</span>
              <span>180j</span>
              <span>365j</span>
            </div>
          </div>
          
          {/* Valeurs rapides */}
          <div className="flex gap-2 flex-wrap justify-center">
            {[1, 7, 15, 30, 60, 90, 180, 365].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  setDurationDays(days);
                  setTempDuration(days.toString());
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  durationDays === days
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {days}j
              </button>
            ))}
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={!isFormValid || isSubmitting} 
          className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-white font-bold py-4 h-14 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin" /> 
              <span className="text-lg">Assignation en cours...</span>
            </>
          ) : (
            <>
              <Target className="mr-3 h-6 w-6" />
              <span className="text-lg">Assigner la Zone</span>
            </>
          )}
        </Button>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};