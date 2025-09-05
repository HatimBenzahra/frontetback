// src/layout/ManagerNavContent.tsx
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui-admin/button';
import { Users, Flag, PieChart, MapPin, FileText, Settings, LayoutDashboard, AudioLines, Building2, Target, Navigation, ScrollText } from 'lucide-react';

// Liens spécifiques au manager
const managerNavLinks = [
  { to: '/manager', text: 'Tableau de Bord', icon: LayoutDashboard }, 
  { to: '/manager/commerciaux', text: 'Mes Commerciaux', icon: Users },
  { to: '/manager/equipes', text: 'Mes Équipes', icon: Flag },
  { to: '/manager/immeubles', text: 'Immeubles', icon: Building2 },
  { to: '/manager/suivi', text: 'Suivi', icon: AudioLines },
  { to: '/manager/transcriptions', text: 'Transcriptions', icon: ScrollText },
  { to: '/manager/gps-tracking', text: 'Suivi GPS', icon: Navigation },
  { to: '/manager/zones', text: 'Zones', icon: MapPin },
  { to: '/manager/assignations-objectifs', text: 'Assignations & Objectifs', icon: Target },
  { to: '/manager/statistiques', text: 'Statistiques', icon: PieChart },

];

interface ManagerNavContentProps {
  isCollapsed: boolean;
  onLinkClick?: () => void;
}

export const ManagerNavContent = ({ isCollapsed, onLinkClick }: ManagerNavContentProps) => {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {managerNavLinks.map((link) => (
        <NavLink to={link.to} key={link.text} end={link.to === '/manager'} onClick={onLinkClick}>
          {({ isActive }) => (
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              className={`w-full justify-start gap-3 h-10 transition-colors duration-200 ${
                isActive
                  ? 'bg-[hsl(var(--winvest-green-clair))] text-[hsl(var(--winvest-green-nuit))] hover:bg-[hsl(var(--winvest-green-clair))]'
                  : 'hover:bg-zinc-100 text-black'
              }`}
            >
              <link.icon className="h-5 w-5" />
              {!isCollapsed && <span className="truncate">{link.text}</span>}
            </Button>
          )}
        </NavLink>
      ))}
    </nav>
  );
};