// src/layout/ManagerLayout.tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ManagerSidebar } from './ManagerSidebar';
import ManagerHeader from './ManagerHeader';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';

const ManagerLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <BreadcrumbProvider>
      <div className="flex h-screen bg-muted/40">
        <ManagerSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
        <div className="flex-1 flex flex-col min-w-0">
          <ManagerHeader />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
};

export default ManagerLayout;