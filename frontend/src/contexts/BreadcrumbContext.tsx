import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbContextType {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  updateBreadcrumbsFromPath: (path: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

// Mapping des routes vers les breadcrumbs
const routeBreadcrumbMap: { [key: string]: BreadcrumbItem[] } = {
  '/admin': [
    { label: 'Espace admin' },
    { label: 'Tableau de Bord' }
  ],
  '/admin/managers': [
    { label: 'Espace admin' },
    { label: 'Managers' }
  ],
  '/admin/commerciaux': [
    { label: 'Espace admin' },
    { label: 'Commerciaux' }
  ],
  '/admin/equipes': [
    { label: 'Espace admin' },
    { label: 'Equipes' }
  ],
  '/admin/immeubles': [
    { label: 'Espace admin' },
    { label: 'Immeubles' }
  ],
  '/admin/suivi': [
    { label: 'Espace admin' },
    { label: 'Suivi' }
  ],
  '/admin/transcriptions': [
    { label: 'Espace admin' },
    { label: 'Transcriptions' }
  ],
  '/admin/gps-tracking': [
    { label: 'Espace admin' },
    { label: 'Suivi GPS' }
  ],
  '/admin/zones': [
    { label: 'Espace admin' },
    { label: 'Zones' }
  ],
  '/admin/assignations-objectifs': [
    { label: 'Espace admin' },
    { label: 'Assignations & Objectifs' }
  ],
  '/admin/statistiques': [
    { label: 'Espace admin' },
    { label: 'Statistiques' }
  ],
  '/admin/rapports': [
    { label: 'Espace admin' },
    { label: 'Rapports & exports' }
  ],
  '/admin/parametres': [
    { label: 'Espace admin' },
    { label: 'Paramètres' }
  ],
};

export const BreadcrumbProvider = ({ children }: { children: ReactNode }) => {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'Espace admin' }
  ]);
  const location = useLocation();

  const updateBreadcrumbsFromPath = (path: string) => {
    const defaultBreadcrumbs = [{ label: 'Espace admin' }];
    const pathBreadcrumbs = routeBreadcrumbMap[path] || defaultBreadcrumbs;
    setBreadcrumbs(pathBreadcrumbs);
  };

  // Mettre à jour automatiquement les breadcrumbs quand l'URL change
  useEffect(() => {
    updateBreadcrumbsFromPath(location.pathname);
  }, [location.pathname]);

  return (
    <BreadcrumbContext.Provider value={{ breadcrumbs, setBreadcrumbs, updateBreadcrumbsFromPath }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

export const useBreadcrumb = () => {
  const context = useContext(BreadcrumbContext);
  if (context === undefined) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }
  return context;
};
