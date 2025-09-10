// src/layout/DirecteurLayout.tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DirecteurSidebar } from './DirecteurSidebar';
import DirecteurHeader from './DirecteurHeader';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';

const DirecteurLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <BreadcrumbProvider>
      <div className="flex h-screen bg-muted/40">
        <DirecteurSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
        <div className="flex-1 flex flex-col min-w-0">
          <DirecteurHeader />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
};

export default DirecteurLayout;
