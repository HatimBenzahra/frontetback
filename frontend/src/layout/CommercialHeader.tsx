
// src/layout/CommercialHeader.tsx
import { useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { LayoutDashboard, Building2, ClipboardList, BarChart3, History } from 'lucide-react';

const CommercialHeader = () => {
  const location = useLocation();

  const getPageInfo = (pathname: string) => {
    if (pathname.includes('/commercial/dashboard')) {
      return { title: 'Tableau de Bord', icon: <LayoutDashboard className="h-6 w-6" /> };
    }
    if (pathname.includes('/commercial/immeubles')) {
      return { title: 'Mes Immeubles', icon: <Building2 className="h-6 w-6" /> };
    }
    if (pathname.includes('/commercial/prospection')) {
      return { title: 'Prospection', icon: <ClipboardList className="h-6 w-6" /> };
    }
    if (pathname.includes('/commercial/stats')) {
      return { title: 'Statistiques', icon: <BarChart3 className="h-6 w-6" /> };
    }
    if (pathname.includes('/commercial/history')) {
      return { title: 'Historique', icon: <History className="h-6 w-6" /> };
    }
    return { title: 'Espace Commercial', icon: null };
  };

  const { title, icon } = getPageInfo(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 bg-white px-4 text-slate-800 shadow-sm sm:px-6">
      {/* Left side: Logo */}
      <div className="flex items-center">
        <img src={logo} alt="Logo" className="h-12 w-auto" />
      </div>

      {/* Center: Page Title */}
      <div className="flex-1 flex justify-center items-center gap-2">
        {icon}
        <h1 className="text-xl font-bold">{title}</h1>
      </div>

      {/* Right side: Placeholder for spacing */}
      <div className="flex items-center w-12"></div>
    </header>
  );
};

export default CommercialHeader;
