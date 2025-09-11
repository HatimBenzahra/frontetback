import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-admin/card';
import { Progress } from '@/components/ui-admin/progress';
import { Target, Info, Calendar, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

interface GoalProgressCardProps {
  title: string;
  description: string;
  value: number;
  total: number;
  startDate?: string;
  endDate?: string;
}

export const GoalProgressCard = ({ title, description, value, total, startDate, endDate }: GoalProgressCardProps) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Fonction pour calculer le temps restant
  const calculateTimeLeft = () => {
    if (!endDate) return '';
    
    const now = new Date().getTime();
    const endTime = new Date(endDate).getTime();
    const difference = endTime - now;

    if (difference > 0) {
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) {
        return `${days} jour${days > 1 ? 's' : ''} ${hours}h`;
      } else if (hours > 0) {
        return `${hours}h restantes`;
      } else {
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        return `${minutes} min restantes`;
      }
    } else {
      return 'Objectif terminé';
    }
  };

  // Mise à jour du countdown chaque minute
  useEffect(() => {
    if (endDate) {
      setTimeLeft(calculateTimeLeft());
      const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
      }, 60000); // Mise à jour chaque minute

      return () => clearInterval(timer);
    }
  }, [endDate]);

  return (
    <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-blue-500" />
            <CardTitle className="text-xl font-bold text-slate-900">{title}</CardTitle>
        </div>
        <CardDescription className="text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center pt-2">
        {total > 0 ? (
          <div className="space-y-4">
            {/* Informations de période et countdown */}
            {(startDate || endDate) && (
              <div className="border-b border-slate-100 pb-3 space-y-2">
                {startDate && endDate && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - {new Date(endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {timeLeft && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className={`font-medium ${timeLeft.includes('Objectif terminé') ? 'text-red-500' : 'text-orange-600'}`}>
                      {timeLeft}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Progression */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-bold text-slate-900">{value}</span>
                <span className="text-lg text-slate-500">/ {total}</span>
              </div>
              <Progress value={percentage} className="h-2.5 bg-slate-100" indicatorClassName="bg-blue-500" />
              <div className="text-right text-sm font-medium text-slate-600">{Math.round(percentage)}% atteint</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-slate-500 h-full py-4">
            <Info className="h-8 w-8 text-slate-400 mb-2" />
            <p className="font-medium">Aucun objectif défini</p>
            <p className="text-sm">Un objectif mensuel sera bientôt assigné.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};