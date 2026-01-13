/**
 * AD Repository Interface
 */

import { ADUser } from '../../shared/types';

export interface UserFilter {
  searchQuery?: string;
  department?: string;
  group?: string;
}

export interface GPOSettings {
  status: 'Enabled' | 'Disabled' | 'Processing';
}

export interface IADRepository {
  getAllUsers(): Promise<ADUser[]>;
  getUserById(id: string): Promise<ADUser | null>;
  findByFilter(filter: UserFilter): Promise<ADUser[]>;
  addUserToGroup(userId: string, groupName: string): Promise<void>;
  removeUserFromGroup(userId: string, groupName: string): Promise<void>;
  getAppLockerGroups(): Promise<string[]>;
  getWinRMGPOStatus(): Promise<GPOSettings>;
  toggleWinRMGPO(enable: boolean): Promise<void>;
}
