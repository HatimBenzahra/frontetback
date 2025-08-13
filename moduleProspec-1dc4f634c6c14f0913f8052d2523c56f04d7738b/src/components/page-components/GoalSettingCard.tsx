import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-admin/popover';
import { Calendar } from '@/components/ui-admin/calendar';
import { Target, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { fr } from 'date-fns/locale';
import type { Commercial } from '@/types/types';

interface GoalSettingCardProps {
  commercials?: Commercial[];
  onSetGlobalGoal: (goal: number, startDate?: string, durationMonths?: number) => Promise<void>;
  currentGlobalGoal?: { goal: number; startDate: string; endDate: string } | null;
}

export const GoalSettingCard = ({ onSetGlobalGoal, currentGlobalGoal }: GoalSettingCardProps) => {
  const [goal, setGoal] = useState<number | string>(currentGlobalGoal?.goal ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [durationMonths, setDurationMonths] = useState<number | string>(1);
  const [isStartOpen, setIsStartOpen] = useState(false);

  const isFormValid = typeof goal === 'number' && goal > 0 && (typeof durationMonths === 'number' && durationMonths > 0);

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    await onSetGlobalGoal(goal as number, startDate ? startDate.toISOString() : undefined, durationMonths as number);
    setIsSubmitting(false);
  };
  
  return (
     <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center text-green-600">
          <Target className="mr-3 h-6 w-6" /> Objectif Global
        </CardTitle>
        <CardDescription>Fixez un objectif global avec une durée (par défaut 1 mois).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input de l'objectif */}
        <div className="space-y-2">
            <label htmlFor="monthly-goal" className="text-sm font-medium">Objectif (nombre de contrats)</label>
            <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                    id="monthly-goal" 
                    type="number" 
                    value={goal}
                    onChange={e => setGoal(e.target.value === '' ? '' : parseInt(e.target.value, 10))} 
                    min="1"
                    placeholder="Ex: 100" 
                    className="pl-10" 
                />
            </div>
        </div>

        {/* Date de début (optionnelle) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Date de début</label>
          <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? startDate.toLocaleDateString('fr-FR') : <span>Choisir une date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => { setStartDate(date); setIsStartOpen(false); }}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Durée en mois */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Durée (mois)</label>
          <input
            type="number"
            min={1}
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>

        <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting} className="w-full bg-green-600 hover:bg-green-700">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
          Définir l'Objectif Global
        </Button>

        {currentGlobalGoal && (
          <div className="text-sm text-gray-600">
            Objectif actuel: <strong>{currentGlobalGoal.goal}</strong> (du {new Date(currentGlobalGoal.startDate).toLocaleDateString()} au {new Date(currentGlobalGoal.endDate).toLocaleDateString()})
          </div>
        )}
      </CardContent>
    </Card>
  );
}