import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { AlertCircle } from 'lucide-react';

interface CountdownCardProps {
  currentGlobalGoal?: { goal: number; startDate: string; endDate: string } | null;
  isLoading?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const calculateTimeRemaining = (targetDate: Date): TimeRemaining => {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const difference = target - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
};

export const CountdownCard = ({ 
  currentGlobalGoal,
  isLoading = false
}: CountdownCardProps) => {
  const [goalTimeRemaining, setGoalTimeRemaining] = useState<TimeRemaining | null>(null);
  const [zoneTimeRemaining, setZoneTimeRemaining] = useState<TimeRemaining | null>(null);
  const [zoneDeadline, setZoneDeadline] = useState<Date | null>(null);

  // Date par défaut pour les zones (fin du trimestre)
  const getNextZoneDeadline = () => {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const nextQuarterStart = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 1);
    return new Date(nextQuarterStart.getTime() - 1); // Fin du trimestre actuel
  };

  const goalEndDate = useMemo(() => 
    currentGlobalGoal ? new Date(currentGlobalGoal.endDate) : null,
    [currentGlobalGoal]
  );

  // Initialiser la deadline des zones une seule fois
  useEffect(() => {
    if (!zoneDeadline) {
      setZoneDeadline(getNextZoneDeadline());
    }
  }, []);

  useEffect(() => {
    // Ne pas démarrer le timer si on est en train de charger ou si zoneDeadline n'est pas définie
    if (isLoading || !zoneDeadline) return;

    // Calcul initial immédiat
    if (goalEndDate) {
      setGoalTimeRemaining(calculateTimeRemaining(goalEndDate));
    }
    setZoneTimeRemaining(calculateTimeRemaining(zoneDeadline));

    // Puis mise à jour chaque seconde
    const timer = setInterval(() => {
      if (goalEndDate) {
        setGoalTimeRemaining(calculateTimeRemaining(goalEndDate));
      }
      setZoneTimeRemaining(calculateTimeRemaining(zoneDeadline));
    }, 1000);

    return () => clearInterval(timer);
  }, [goalEndDate, zoneDeadline, isLoading]);

  const isGoalExpired = !isLoading && goalEndDate && goalTimeRemaining && 
                       goalTimeRemaining.days === 0 && goalTimeRemaining.hours === 0 && 
                       goalTimeRemaining.minutes === 0 && goalTimeRemaining.seconds === 0;
  
  const isZoneExpired = !isLoading && zoneTimeRemaining && 
                       zoneTimeRemaining.days === 0 && zoneTimeRemaining.hours === 0 && 
                       zoneTimeRemaining.minutes === 0 && zoneTimeRemaining.seconds === 0;


  // Ne rien afficher pendant le chargement
  if (isLoading) {
    return null;
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm w-full h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Prochaines Échéances
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 h-full flex flex-col">
        <div className="space-y-4 flex-1">
          {/* Countdown pour les objectifs */}
          <div className={`p-4 rounded-lg border-l-4 ${isGoalExpired ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400'}`}>
            <div className="mb-3">
              <span className="text-sm font-medium text-gray-900">Objectif Global</span>
            </div>
            
            {!currentGlobalGoal ? (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Aucun objectif défini</span>
              </div>
            ) : isGoalExpired ? (
              <div className="text-red-600 font-semibold text-sm">
                Redéfinition requise
              </div>
            ) : goalTimeRemaining ? (
              <>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center">
                    <div className="font-bold text-2xl text-green-600">{goalTimeRemaining.days}</div>
                    <div className="text-xs text-gray-600">jours</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-green-600">{goalTimeRemaining.hours}</div>
                    <div className="text-xs text-gray-600">heures</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-green-600">{goalTimeRemaining.minutes}</div>
                    <div className="text-xs text-gray-600">min</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-green-600">{goalTimeRemaining.seconds}</div>
                    <div className="text-xs text-gray-600">sec</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Redéfinition: {goalEndDate?.toLocaleDateString('fr-FR')} à {goalEndDate?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 text-sm">
                Chargement...
              </div>
            )}
          </div>

          {/* Countdown pour les zones */}
          <div className={`p-4 rounded-lg border-l-4 ${isZoneExpired ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}`}>
            <div className="mb-3">
              <span className="text-sm font-medium text-gray-900">Assignation Zones</span>
            </div>
            
            {isZoneExpired ? (
              <div className="text-red-600 font-semibold text-sm">
                Redéfinition requise
              </div>
            ) : zoneTimeRemaining ? (
              <>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center">
                    <div className="font-bold text-2xl text-blue-600">{zoneTimeRemaining.days}</div>
                    <div className="text-xs text-gray-600">jours</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-blue-600">{zoneTimeRemaining.hours}</div>
                    <div className="text-xs text-gray-600">heures</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-blue-600">{zoneTimeRemaining.minutes}</div>
                    <div className="text-xs text-gray-600">min</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-blue-600">{zoneTimeRemaining.seconds}</div>
                    <div className="text-xs text-gray-600">sec</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Redéfinition: {zoneDeadline?.toLocaleDateString('fr-FR')}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 text-sm">
                Chargement...
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};