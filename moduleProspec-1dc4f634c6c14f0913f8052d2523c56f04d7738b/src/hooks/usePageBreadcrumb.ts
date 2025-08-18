import { useEffect } from 'react';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';

interface UsePageBreadcrumbProps {
  basePath: string;
  pageTitle: string;
  subPages?: Array<{ label: string; isActive?: boolean }>;
}

export const usePageBreadcrumb = ({ basePath, pageTitle, subPages = [] }: UsePageBreadcrumbProps) => {
  const { setBreadcrumbs } = useBreadcrumb();
  // Stabilize dependency for subPages to avoid infinite loops due to array identity
  const subPagesKey = JSON.stringify(subPages);

  useEffect(() => {
    const breadcrumbs = [
      { label: 'Espace admin' },
      { label: pageTitle }
    ];

    // Ajouter les sous-pages si elles existent
    subPages.forEach(subPage => {
      breadcrumbs.push({ label: subPage.label });
    });

    setBreadcrumbs(breadcrumbs);
  }, [basePath, pageTitle, subPagesKey, setBreadcrumbs]);
};
