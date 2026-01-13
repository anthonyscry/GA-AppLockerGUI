
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SCAN = 'SCAN',
  POLICY = 'POLICY',
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
  publisherName: string; // The exact string for the AppLocker rule
  category: 'Browser' | 'Communication' | 'Development' | 'Infrastructure' | 'System' | 'Productivity';
  description: string;
}

export interface ADUser {
  id: string;
  samAccountName: string;
  displayName: string;
  department: string;
  groups: string[];
}

export interface AppEvent {
  id: string;
  timestamp: string;
  machine: string;
  path: string;
  publisher: string;
  eventId: 8003 | 8004; // 8003: Allowed (Audit), 8004: Blocked (Audit)
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
