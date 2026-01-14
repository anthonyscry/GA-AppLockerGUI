/**
 * Shared Types
 * Central type definitions used across the application
 */

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SCAN = 'SCAN',
  RULE_GENERATOR = 'RULE_GENERATOR',
  POLICY = 'POLICY',
  SOFTWARE_COMPARE = 'SOFTWARE_COMPARE',
  EVENTS = 'EVENTS',
  AD_MANAGEMENT = 'AD_MANAGEMENT',
  COMPLIANCE = 'COMPLIANCE'
}

export enum PolicyPhase {
  PHASE_1 = 'Phase 1 (EXE Only)',
  PHASE_2 = 'Phase 2 (EXE + Script)',
  PHASE_3 = 'Phase 3 (EXE + Script + MSI)',
  PHASE_4 = 'Phase 4 (All including DLL)'
}

export interface MachineScan {
  id: string;
  hostname: string;
  lastScan: string;
  status: 'Online' | 'Offline' | 'Scanning';
  riskLevel: 'Low' | 'Medium' | 'High';
  appCount: number;
  ou?: string;  // Organizational Unit path (e.g., "OU=Workstations,OU=Computers,DC=domain,DC=com")
}

// Machine type derived from OU path
export type MachineType = 'Workstation' | 'Server' | 'DomainController' | 'Unknown';

// Helper to derive machine type from OU path
export function getMachineTypeFromOU(ou: string | undefined): MachineType {
  if (!ou) return 'Unknown';
  const ouLower = ou.toLowerCase();
  
  // Domain Controllers are in a special OU
  if (ouLower.includes('domain controllers')) return 'DomainController';
  
  // Common naming conventions for servers
  if (ouLower.includes('server') || ouLower.includes('srv')) return 'Server';
  
  // Common naming conventions for workstations
  if (ouLower.includes('workstation') || ouLower.includes('computer') || 
      ouLower.includes('desktop') || ouLower.includes('laptop') ||
      ouLower.includes('wkst') || ouLower.includes('ws')) return 'Workstation';
  
  return 'Unknown';
}

// Group machines by their OU-derived type
export interface MachinesByType {
  workstations: MachineScan[];
  servers: MachineScan[];
  domainControllers: MachineScan[];
  unknown: MachineScan[];
}

export function groupMachinesByOU(machines: MachineScan[]): MachinesByType {
  return machines.reduce((acc, machine) => {
    const type = getMachineTypeFromOU(machine.ou);
    switch (type) {
      case 'Workstation':
        acc.workstations.push(machine);
        break;
      case 'Server':
        acc.servers.push(machine);
        break;
      case 'DomainController':
        acc.domainControllers.push(machine);
        break;
      default:
        acc.unknown.push(machine);
    }
    return acc;
  }, {
    workstations: [] as MachineScan[],
    servers: [] as MachineScan[],
    domainControllers: [] as MachineScan[],
    unknown: [] as MachineScan[]
  });
}

export interface InventoryItem {
  id: string;
  name: string;
  publisher: string;
  path: string;
  version: string;
  type: 'EXE' | 'MSI' | 'Script' | 'DLL';
}

export interface TrustedPublisher {
  id: string;
  name: string;
  publisherName: string;
  category: 'Browser' | 'Communication' | 'Development' | 'Infrastructure' | 'System' | 'Productivity';
  description: string;
}

export interface ADUser {
  id: string;
  samAccountName: string;
  displayName: string;
  department: string;
  ou: string;  // Organizational Unit path (e.g., "OU=Users,OU=HQ,DC=domain,DC=com")
  groups: string[];
}

export interface AppEvent {
  id: string;
  timestamp: string;
  machine: string;
  path: string;
  publisher: string;
  eventId: 8001 | 8002 | 8003 | 8004;
  action: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  type: 'Path' | 'Publisher' | 'Hash';
  category: 'EXE' | 'MSI' | 'Script' | 'DLL';
  status: 'Allow' | 'Deny';
  user: string;
}
