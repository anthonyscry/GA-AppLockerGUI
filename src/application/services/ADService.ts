/**
 * AD Service
 * Business logic for Active Directory operations
 */

import { IADRepository, UserFilter, GPOSettings } from '../../domain/interfaces/IADRepository';
import { ADUser } from '../../shared/types';
import { logger } from '../../infrastructure/logging/Logger';

export class ADService {
  constructor(private readonly repository: IADRepository) {}

  /**
   * Get all AD users
   */
  async getAllUsers(): Promise<ADUser[]> {
    return this.repository.getAllUsers();
  }

  /**
   * Filter users based on criteria
   */
  async filterUsers(_users: ADUser[], filter: UserFilter): Promise<ADUser[]> {
    return this.repository.findByFilter(filter);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<ADUser | null> {
    return this.repository.getUserById(id);
  }

  /**
   * Add user to AppLocker group
   */
  async addUserToGroup(userId: string, groupName: string): Promise<void> {
    logger.info(`Adding user ${userId} to group ${groupName}`);
    await this.repository.addUserToGroup(userId, groupName);
  }

  /**
   * Remove user from AppLocker group
   */
  async removeUserFromGroup(userId: string, groupName: string): Promise<void> {
    logger.info(`Removing user ${userId} from group ${groupName}`);
    await this.repository.removeUserFromGroup(userId, groupName);
  }

  /**
   * Get available AppLocker groups
   */
  async getAppLockerGroups(): Promise<string[]> {
    return this.repository.getAppLockerGroups();
  }

  /**
   * Get WinRM GPO status
   */
  async getWinRMGPOStatus(): Promise<GPOSettings> {
    return this.repository.getWinRMGPOStatus();
  }

  /**
   * Toggle WinRM GPO
   */
  async toggleWinRMGPO(enable: boolean): Promise<void> {
    logger.info(`${enable ? 'Enabling' : 'Disabling'} WinRM GPO`);
    await this.repository.toggleWinRMGPO(enable);
  }
}
