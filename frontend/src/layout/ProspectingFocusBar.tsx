import { useProspecting } from '@/contexts/ProspectingContext';
import { Button } from '@/components/ui-admin/button';
import { Lock, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui-admin/alert-dialog';

const ProspectingFocusBar = () => {
  const { isProspecting, buildingName, startTime, stopProspecting } = useProspecting();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isProspecting && startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isProspecting, startTime]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStop = () => {
    stopProspecting();
    navigate('/commercial/prospecting');
  };

  if (!isProspecting) return null;

  return (
    <>
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Lock className="h-6 w-6" />
          <div>
            <div className="font-bold">Mode Prospection</div>
            <div className="text-sm">{buildingName}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Timer className="h-6 w-6" />
            <div className="font-mono text-lg">{formatTime(elapsedTime)}</div>
          </div>
          <Button variant="destructive" onClick={() => setIsConfirmOpen(true)} className="bg-red-600 text-white hover:bg-red-700">Arrêter</Button>
        </div>
      </div>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arrêter la prospection ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir arrêter la session de prospection en cours ? Le minuteur sera réinitialisé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleStop} className="bg-red-600 text-white hover:bg-red-700">Arrêter</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProspectingFocusBar;