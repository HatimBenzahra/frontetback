// src/layout/AdminSidebar.tsx
import { Button } from '@/components/ui-admin/button';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AdminNavContent } from './AdminNavContent';
import logo from '@/assets/logo.png';

interface AdminSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export const AdminSidebar = ({ isCollapsed, toggleSidebar }: AdminSidebarProps) => {
  return (
    <aside
      className={`hidden lg:flex flex-col bg-[#FAFAFA] transition-all duration-300 sticky top-0 h-screen ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* HEADER CORRIGÉ */}
      <div
        className={`flex items-center h-20 px-4 shrink-0 ${ // shrink-0 empêche le header de se réduire
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {/* Le logo n'est visible que si la sidebar est dépliée */}
        {!isCollapsed && (
          // Le logo est dans un conteneur pour ne pas perturber le flexbox
          <div className="flex-1"> 
            <img
              src={logo}
              alt="Logo Groupe Finanssor"
              className="h-30 w-auto object-contain -translate-x-6" // Votre style est conservé
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
      <div className="flex-1 overflow-y-auto"> {/* Ajout de overflow-y-auto pour les petits écrans */}
        <AdminNavContent isCollapsed={isCollapsed} />
      </div>

    </aside>
  );
};