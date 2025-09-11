import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, children }) => {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 mb-6 rounded-lg shadow-sm">
      <div className="-ml-4 -mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap">
        <div className="ml-4 mt-2">
          <h2 className="text-xl font-semibold leading-6 text-gray-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        <div className="ml-4 mt-2 flex-shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
