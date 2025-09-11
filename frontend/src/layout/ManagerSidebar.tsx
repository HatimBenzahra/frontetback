// src/layout/ManagerSidebar.tsx
import { Button } from '@/components/ui-admin/button';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ManagerNavContent } from './ManagerNavContent';
import logo from '@/assets/logo.png';

interface ManagerSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export const ManagerSidebar = ({ isCollapsed, toggleSidebar }: ManagerSidebarProps) => {
  return (
    <aside
      className={`hidden lg:flex flex-col bg-[#E8F5E8] transition-all duration-300 sticky top-0 h-screen ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* HEADER */}
      <div
        className={`flex items-center h-20 px-4 shrink-0 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {/* Logo visible seulement si la sidebar est dépliée */}
        {!isCollapsed && (
          <div className="flex-1"> 
            <img
              src={logo}
              alt="Logo Groupe Finanssor"
              className="h-30 w-auto object-contain -translate-x-6"
            />
          </div>
        )}

        {/* Bouton pour plier/déplier */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      {/* NAVIGATION */}
      <div className="flex-1 overflow-y-auto">
        <ManagerNavContent isCollapsed={isCollapsed} />
      </div>

    </aside>
  );
};