import React, { createContext, useState, useContext, useMemo, ReactNode } from 'react';

interface ProspectingContextType {
  isProspecting: boolean;
  startTime: number | null;
  buildingId: string | null;
  buildingName: string | null;
  startProspecting: (id: string, name: string) => void;
  stopProspecting: () => void;
}

const ProspectingContext = createContext<ProspectingContextType | undefined>(undefined);

export const ProspectingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isProspecting, setIsProspecting] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [buildingName, setBuildingName] = useState<string | null>(null);

  const startProspecting = (id: string, name: string) => {
    setBuildingId(id);
    setBuildingName(name);
    setStartTime(Date.now());
    setIsProspecting(true);
  };

  const stopProspecting = () => {
    setIsProspecting(false);
    setStartTime(null);
    setBuildingId(null);
    setBuildingName(null);
  };

  const value = useMemo(() => ({
    isProspecting,
    startTime,
    buildingId,
    buildingName,
    startProspecting,
    stopProspecting,
  }), [isProspecting, startTime, buildingId, buildingName]);

  return (
    <ProspectingContext.Provider value={value}>
      {children}
    </ProspectingContext.Provider>
  );
};

export const useProspecting = () => {
  const context = useContext(ProspectingContext);
  if (context === undefined) {
    throw new Error('useProspecting must be used within a ProspectingProvider');
  }
  return context;
};