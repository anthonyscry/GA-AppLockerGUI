/**
 * Machine Repository Interface
 * Defines contract for machine data access
 */

import { MachineScan } from '../../shared/types';

export interface MachineFilter {
  searchQuery?: string;
  ouPath?: string;
  status?: string;
  riskLevel?: string;
}

export interface ScanCredentials {
  username?: string;
  password?: string;
  domain?: string;
  useCurrentUser?: boolean;
}

export interface ScanOptions {
  targetOUs?: string[];
  timeout?: number;
  credentials?: ScanCredentials;
  computerNames?: string[];
}

export interface IMachineRepository {
  findAll(): Promise<MachineScan[]>;
  findById(id: string): Promise<MachineScan | null>;
  findByFilter(filter: MachineFilter): Promise<MachineScan[]>;
  startScan(options: ScanOptions): Promise<void>;
}
