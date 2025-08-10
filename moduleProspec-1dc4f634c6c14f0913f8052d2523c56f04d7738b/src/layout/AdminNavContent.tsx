// src/layout/AdminNavContent.tsx
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui-admin/button';
import { Users, Flag, PieChart, MapPin, FileText, Settings, LayoutDashboard, AudioLines, Building2, Target, Navigation } from 'lucide-react';

// Liens spécifiques à l'administrateur
const adminNavLinks = [
  { to: '/admin', text: 'Tableau de Bord', icon: LayoutDashboard }, 
  { to: '/admin/managers', text: 'Managers', icon: Users },
  { to: '/admin/commerciaux', text: 'Commerciaux', icon: Users },
  { to: '/admin/equipes', text: 'Equipes', icon: Flag },
  { to: '/admin/immeubles', text: 'Immeubles', icon: Building2 },
  { to: '/admin/suivi', text: 'Suivi', icon: AudioLines },
  { to: '/admin/gps-tracking', text: 'Suivi GPS', icon: Navigation },
  { to: '/admin/zones', text: 'Zones', icon: MapPin },
  { to: '/admin/assignations-objectifs', text: 'Assignations & Objectifs', icon: Target },
  { to: '/admin/statistiques', text: 'Statistiques', icon: PieChart },
  { to: '/admin/rapports', text: 'Rapports & exports', icon: FileText },
  { to: '/admin/parametres', text: 'Paramètres', icon: Settings },
];

interface AdminNavContentProps {
  isCollapsed: boolean;
  onLinkClick?: () => void;
}

export const AdminNavContent = ({ isCollapsed, onLinkClick }: AdminNavContentProps) => {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {adminNavLinks.map((link) => (
        <NavLink to={link.to} key={link.text} end={link.to === '/admin'} onClick={onLinkClick}>
          {({ isActive }) => (
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              className={`w-full justify-start gap-3 h-10 transition-colors duration-200 ${
                isActive
                  ? 'bg-[hsl(var(--winvest-blue-clair))] text-[hsl(var(--winvest-blue-nuit))] hover:bg-[hsl(var(--winvest-blue-clair))]'
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