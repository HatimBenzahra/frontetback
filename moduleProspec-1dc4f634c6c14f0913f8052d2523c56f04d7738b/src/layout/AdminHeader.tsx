// src/layout/AdminHeader.tsx
import { useState } from 'react'; // 'useEffect' a été retiré car non utilisé
import { Button } from '@/components/ui-admin/button';
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from '@/components/ui-admin/sheet';
import { Menu, ChevronRight, Home } from 'lucide-react';
import { AdminNavContent } from './AdminNavContent';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';

import { DateTimeDisplay } from './DateTimeDisplay';
import { UserNav } from './UserNav';

const AdminHeader = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { breadcrumbs } = useBreadcrumb();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-b-[hsl(var(--winvest-blue-moyen))] bg-[hsl(var(--winvest-blue-moyen))] px-4 text-white sm:px-6">
      {/* Section de gauche : Menu hamburger, titre et breadcrumb */}
      <div className="flex items-center gap-4">
        <div className="lg:hidden">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="border-white/30 bg-transparent text-white hover:bg-black/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px] p-0 bg-white">
              <SheetHeader className='p-4 border-b'></SheetHeader>
              <div className="py-4">
                <AdminNavContent isCollapsed={false} onLinkClick={() => setIsSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Breadcrumb */}
        <div className="hidden md:flex items-center space-x-2 text-sm">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              {index === 0 && <Home className="h-4 w-4" />}
              <span className={index === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-white/80'}>
                {item.label}
              </span>
              {index < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 text-white/60" />}
            </div>
          ))}
        </div>
        
        {/* Titre mobile */}
        <h1 className="text-xl md:text-2xl font-bold md:hidden">Espace Admin</h1>
      </div>
      
      {/* Section de droite : Date, Heure et Menu Utilisateur */}
      <div className="flex items-center gap-4">
        <DateTimeDisplay />
        <div className="border-l h-8"></div> {/* Votre séparateur est bien conservé */}
        <UserNav />
      </div>
    </header>
  );
};

export default AdminHeader;