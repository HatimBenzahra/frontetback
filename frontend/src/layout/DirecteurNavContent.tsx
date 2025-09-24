// src/layout/DirecteurNavContent.tsx
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui-admin/button';
import { Users, BarChart3, Settings, LayoutDashboard, Building2, Target, TrendingUp, FileText, UserCheck } from 'lucide-react';

// Liens spécifiques au directeur
const directeurNavLinks = [
  { to: '/directeur', text: 'Tableau de Bord', icon: LayoutDashboard }, 
  { to: '/directeur/managers', text: 'Managers', icon: UserCheck },
  { to: '/directeur/equipes', text: 'Équipes', icon: Users },
  { to: '/directeur/commerciaux', text: 'Commerciaux', icon: Building2 },
  { to: '/directeur/objectifs', text: 'Objectifs', icon: Target },
  { to: '/directeur/statistiques', text: 'Statistiques', icon: BarChart3 },
  { to: '/directeur/analytics', text: 'Analytics', icon: TrendingUp },
  { to: '/directeur/rapports', text: 'Rapports', icon: FileText },
  { to: '/directeur/parametres', text: 'Paramètres', icon: Settings },
];

interface DirecteurNavContentProps {
  isCollapsed: boolean;
  onLinkClick?: () => void;
}

export const DirecteurNavContent = ({ isCollapsed, onLinkClick }: DirecteurNavContentProps) => {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {directeurNavLinks.map((link) => (
        <NavLink to={link.to} key={link.text} end={link.to === '/directeur'} onClick={onLinkClick}>
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
