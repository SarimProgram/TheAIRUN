import React, { createContext, useContext, type ReactNode } from 'react';
import { useRaceSocket, type UseRaceSocketResult } from '@/hooks/useRaceSocket';

const RaceSocketContext = createContext<UseRaceSocketResult | null>(null);

export function RaceSocketProvider({ children }: { children: ReactNode }) {
  const raceSocket = useRaceSocket();

  return (
    <RaceSocketContext.Provider value={raceSocket}>
      {children}
    </RaceSocketContext.Provider>
  );
}

export function useRaceSocketContext(): UseRaceSocketResult {
  const context = useContext(RaceSocketContext);
  if (!context) {
    throw new Error('useRaceSocketContext must be used within a RaceSocketProvider');
  }
  return context;
}
