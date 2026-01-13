/**
 * App Context
 * Provides access to DI container and services
 */

import { createContext, useContext, ReactNode } from 'react';
import { container } from '../../infrastructure/di/Container';
import { MachineService } from '../../application/services/MachineService';
import { PolicyService } from '../../application/services/PolicyService';
import { EventService } from '../../application/services/EventService';
import { ADService } from '../../application/services/ADService';
import { ComplianceService } from '../../application/services/ComplianceService';

interface AppContextValue {
  services: {
    machine: MachineService;
    policy: PolicyService;
    event: EventService;
    ad: ADService;
    compliance: ComplianceService;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const services = {
    machine: container.resolve<MachineService>('MachineService'),
    policy: container.resolve<PolicyService>('PolicyService'),
    event: container.resolve<EventService>('EventService'),
    ad: container.resolve<ADService>('ADService'),
    compliance: container.resolve<ComplianceService>('ComplianceService'),
  };

  return (
    <AppContext.Provider value={{ services }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppServices() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppServices must be used within AppProvider');
  }
  return context.services;
}
