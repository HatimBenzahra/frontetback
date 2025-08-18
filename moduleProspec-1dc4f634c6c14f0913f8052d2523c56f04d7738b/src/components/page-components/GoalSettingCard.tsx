import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-admin/popover';
import { Calendar } from '@/components/ui-admin/calendar';
import { Slider } from '@/components/ui-admin/slider';
import { Target, Loader2, Calendar as CalendarIcon, Edit3, Save } from 'lucide-react';
import { fr } from 'date-fns/locale';
import { startOfToday } from 'date-fns';
import type { Commercial } from '@/types/types';

interface GoalSettingCardProps {
  commercials?: Commercial[];
  onSetGlobalGoal: (goal: number, startDate?: string, durationMonths?: number) => Promise<void>;
  currentGlobalGoal?: { goal: number; startDate: string; endDate: string } | null;
  totalCommerciaux?: number;
}

export const GoalSettingCard = ({ onSetGlobalGoal, currentGlobalGoal, totalCommerciaux }: GoalSettingCardProps) => {
  const [goal, setGoal] = useState<number>(currentGlobalGoal?.goal ?? 100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [durationMonths, setDurationMonths] = useState<number | string>(1);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState<string>(goal.toString());

  // Date minimale (aujourd'hui)
  const today = startOfToday();
  const disabledDays = { before: today };

  const isFormValid = goal > 0 && (typeof durationMonths === 'number' && durationMonths > 0) && startDate;

  // Fonction pour gérer la modification manuelle de l'objectif
  const handleGoalEdit = () => {
    if (isEditingGoal) {
      const newGoal = parseInt(tempGoal);
      if (!isNaN(newGoal) && newGoal > 0) {
        setGoal(newGoal);
      }
    }
    setIsEditingGoal(!isEditingGoal);
  };

  // Fonction pour valider la saisie manuelle
  const handleGoalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTempGoal(value);
    
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      setGoal(numValue);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    await onSetGlobalGoal(goal, startDate!.toISOString(), durationMonths as number);
    setIsSubmitting(false);
  };
  
  return (
     <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-green-50">
      <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center text-white">
          <div className="p-2 bg-white/20 rounded-lg mr-3">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold">Objectif Global</div>
            <div className="text-green-100 text-sm font-normal">Définition des cibles commerciales</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {/* Slider de l'objectif */}
        <div className="space-y-4">
            <label className="text-sm font-semibold text-gray-700 flex items-center">
              <Target className="h-4 w-4 mr-2 text-green-600" />
              Objectif par commercial (nombre de contrats)
            </label>
            
            {/* Affichage de la valeur actuelle avec possibilité de modification */}
            <div className="text-center">
              {isEditingGoal ? (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Input
                    type="number"
                    value={tempGoal}
                    onChange={handleGoalInputChange}
                    className="text-4xl font-bold text-green-700 text-center w-32 h-16 border-2 border-green-300 focus:border-green-500"
                    min="1"
                    max="9999"
                    autoFocus
                  />
                  <button
                    onClick={handleGoalEdit}
                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Save className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-4xl font-bold text-green-700 cursor-pointer hover:text-green-800 transition-colors" onClick={handleGoalEdit}>
                    {goal}
                  </div>
                  <button
                    onClick={handleGoalEdit}
                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="text-sm text-green-600 font-medium">contrats par commercial</div>
            </div>
            
            {/* Slider */}
            <div className="px-4">
              <Slider
                value={[goal]}
                onValueChange={(value) => setGoal(value[0])}
                max={1000}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>1</span>
                <span>250</span>
                <span>500</span>
                <span>750</span>
                <span>1000</span>
              </div>
            </div>
            
            {/* Valeurs rapides */}
            <div className="flex gap-2 flex-wrap justify-center">
              {[5, 10, 25, 50, 100, 200, 300, 500].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGoal(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    goal === value
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
        </div>

        {/* Date de début (obligatoire) */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <CalendarIcon className="h-4 w-4 mr-2 text-green-600" />
            Date de début <span className="text-red-500">*</span>
          </label>
          <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal h-11 border-green-200 hover:border-green-500 hover:bg-green-50">
                <CalendarIcon className="mr-2 h-4 w-4 text-green-600" />
                {startDate ? (
                  <span className="font-medium">{startDate.toLocaleDateString('fr-FR')}</span>
                ) : (
                  <span className="text-gray-500">Choisir une date de début</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => { setStartDate(date); setIsStartOpen(false); }}
                disabled={disabledDays}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Durée en mois */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700">Durée de l'objectif</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 3, 6, 12].map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setDurationMonths(months)}
                className={`p-3 rounded-lg border-2 transition-all duration-200 font-medium text-sm ${
                  durationMonths === months
                    ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {months} mois
              </button>
            ))}
          </div>
          <div className="mt-2">
            <input
              type="number"
              min={1}
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="Durée personnalisée..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            />
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={!isFormValid || isSubmitting} 
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 h-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 
              <span>Définition en cours...</span>
            </>
          ) : (
            <>
              <Target className="mr-2 h-5 w-5" />
              <span>Définir l'Objectif Global</span>
            </>
          )}
        </Button>

        {currentGlobalGoal && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-inner">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-500 rounded-lg mr-3">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-green-800 text-lg">Objectif par Commercial</div>
                  <div className="text-green-600 text-sm">Chaque commercial doit atteindre</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-700">{currentGlobalGoal.goal}</div>
                <div className="text-sm text-green-600 font-medium">contrats</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Période</div>
                <div className="text-sm font-semibold text-gray-800 mt-1">
                  Du {new Date(currentGlobalGoal.startDate).toLocaleDateString('fr-FR')}
                </div>
                <div className="text-sm font-semibold text-gray-800">
                  Au {new Date(currentGlobalGoal.endDate).toLocaleDateString('fr-FR')}
                </div>
              </div>
              
              {totalCommerciaux && totalCommerciaux > 0 && (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Impact Total</div>
                  <div className="text-sm font-semibold text-gray-800 mt-1">
                    {totalCommerciaux} commerciaux
                  </div>
                  <div className="text-lg font-bold text-green-700">
                    {currentGlobalGoal.goal} contrats chacun
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total potentiel : {currentGlobalGoal.goal * totalCommerciaux} contrats
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}