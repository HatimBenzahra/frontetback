    // src/layout/DateTimeDisplay.tsx
import { useState, useEffect } from 'react';

// Hook personnalisé pour formater la date et l'heure
const useDateTime = () => {
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setDate(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const day = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    const dayNumber = date.getDate();
    const month = date.toLocaleDateString('fr-FR', { month: 'long' });

    const time = date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
    });
    const seconds = date.toLocaleTimeString('fr-FR', { second: '2-digit' });

    // Capitaliser la première lettre du jour et du mois
    const formattedDay = day.charAt(0).toUpperCase() + day.slice(1);
    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

    return {
        dateString: `${formattedDay} ${dayNumber} ${formattedMonth}`,
        timeString: time,
        secondsString: seconds,
    };
};


export const DateTimeDisplay = () => {
  const { dateString, timeString} = useDateTime();

  return (
    <div className="hidden md:flex items-center gap-4 bg-black/10 px-4 py-1.5 rounded-lg border border-white/90">
      {/* Section Date */}
      <div className="text-right">
        <span className="text-sm font-semibold tracking-wide">{dateString}</span>
      </div>

      {/* Séparateur */}
      <div className="h-6 w-px bg-white/30"></div>

      {/* Section Heure */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tighter">{timeString}</span>
        {/* Les secondes clignotent avec une opacité variable */}
      </div>
    </div>
  );
};