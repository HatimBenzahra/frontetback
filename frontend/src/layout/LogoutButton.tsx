// src/layout/LogoutButton.tsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui-admin/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui-admin/tooltip"
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoutButtonProps {
  // Contexte pour adapter le style (fond bleu vs fond blanc)
  context?: 'header' | 'sidebar';
}

export function LogoutButton({ context = 'sidebar' }: LogoutButtonProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  
  // Styles différents pour le bouton selon où il se trouve
  const buttonVariant = context === 'header' ? 'ghost' : 'outline';
  const buttonClasses = context === 'header' ? 'text-white hover:bg-black/10 hover:text-white border-white/30' : '';

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={buttonVariant}
            size="icon"
            onClick={handleLogout}
            className={cn(buttonClasses)}
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Déconnexion</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Déconnexion</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}