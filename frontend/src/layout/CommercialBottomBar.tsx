
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Target,
    History,
    BarChart2,
    Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserNav } from './UserNav';

const navLinks = [
    { to: '/commercial/dashboard', text: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/commercial/immeubles', text: 'Immeubles', icon: Building, exact: true },
    { to: '/commercial/prospecting', text: 'Prospection', icon: Target, exact: false },
    { to: '/commercial/history', text: 'Historique', icon: History, exact: true },
    { to: '/commercial/stats', text: 'Stats', icon: BarChart2, exact: true },
];

export const CommercialBottomBar = () => {
  return (
    // Main container with a modern blurred background effect
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-gray-50/90 border-t border-gray-200 backdrop-blur-lg">
      <div className="grid h-full grid-cols-6 max-w-lg mx-auto">
        {navLinks.map((link) => (
          <NavLink
            to={link.to}
            key={link.text}
            end={link.exact}
            className={({ isActive }) =>
              cn(
                'inline-flex flex-col items-center justify-center px-2 pt-2 pb-1 rounded-lg transition-colors duration-200',
                'text-gray-500 hover:bg-gray-200 hover:text-gray-800', // Base and hover state
                isActive && 'text-blue-600' // Active state: only color changes for a clean look
              )
            }
          >
            <link.icon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium tracking-tight">{link.text}</span>
          </NavLink>
        ))}
        
        {/* UserNav button with a distinct, circular style */}
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-[hsl(var(--winvest-blue-moyen))] shadow-md">
            <UserNav />
          </div>
        </div>
      </div>
    </div>
  );
};
