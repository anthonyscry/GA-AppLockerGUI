/**
 * AD Repository Implementation
 */

import { IADRepository, UserFilter, GPOSettings } from '../../domain/interfaces/IADRepository';
import { ADUser } from '../../shared/types';
import { ipcClient } from '../ipc/ipcClient';
import { IPCChannels } from '../ipc/channels';
import { logger } from '../logging/Logger';
import { NotFoundError, ExternalServiceError } from '../../domain/errors';

export class ADRepository implements IADRepository {
  async getAllUsers(): Promise<ADUser[]> {
    try {
      const users = await ipcClient.invoke<ADUser[]>(IPCChannels.AD.GET_USERS);
      return users || [];
    } catch (error) {
      logger.error('Failed to fetch AD users', error as Error);
      throw new ExternalServiceError('AD Service', 'Failed to fetch AD users', error as Error);
    }
  }

  async getUserById(id: string): Promise<ADUser | null> {
    try {
      const user = await ipcClient.invoke<ADUser | null>(IPCChannels.AD.GET_USER_BY_ID, id);
      if (!user) {
        throw new NotFoundError('AD User', id);
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error(`Failed to find AD user ${id}`, error as Error);
      throw new ExternalServiceError('AD Service', `Failed to find AD user ${id}`, error as Error);
    }
  }

  async findByFilter(filter: UserFilter): Promise<ADUser[]> {
    const all = await this.getAllUsers();
    return this.filterUsers(all, filter);
  }

  async addUserToGroup(userId: string, groupName: string): Promise<void> {
    try {
      logger.info(`Adding user ${userId} to group ${groupName}`);
      await ipcClient.invoke(IPCChannels.AD.ADD_TO_GROUP, userId, groupName);
      logger.info(`User ${userId} added to group ${groupName} successfully`);
    } catch (error) {
      logger.error(`Failed to add user ${userId} to group ${groupName}`, error as Error);
      throw new ExternalServiceError('AD Service', `Failed to add user to group`, error as Error);
    }
  }

  async removeUserFromGroup(userId: string, groupName: string): Promise<void> {
    try {
      logger.info(`Removing user ${userId} from group ${groupName}`);
      await ipcClient.invoke(IPCChannels.AD.REMOVE_FROM_GROUP, userId, groupName);
      logger.info(`User ${userId} removed from group ${groupName} successfully`);
    } catch (error) {
      logger.error(`Failed to remove user ${userId} from group ${groupName}`, error as Error);
      throw new ExternalServiceError('AD Service', `Failed to remove user from group`, error as Error);
    }
  }

  async getAppLockerGroups(): Promise<string[]> {
    try {
      const groups = await ipcClient.invoke<string[]>(IPCChannels.AD.GET_GROUPS);
      return groups || [];
    } catch (error) {
      logger.error('Failed to fetch AppLocker groups', error as Error);
      throw new ExternalServiceError('AD Service', 'Failed to fetch AppLocker groups', error as Error);
    }
  }

  async getWinRMGPOStatus(): Promise<GPOSettings> {
    try {
      const status = await ipcClient.invoke<GPOSettings>(IPCChannels.AD.GET_WINRM_GPO_STATUS);
      return status || { status: 'Disabled' };
    } catch (error) {
      logger.error('Failed to get WinRM GPO status', error as Error);
      throw new ExternalServiceError('AD Service', 'Failed to get WinRM GPO status', error as Error);
    }
  }

  async toggleWinRMGPO(enable: boolean): Promise<void> {
    try {
      logger.info(`${enable ? 'Enabling' : 'Disabling'} WinRM GPO`);
      await ipcClient.invoke(IPCChannels.AD.TOGGLE_WINRM_GPO, enable);
      logger.info(`WinRM GPO ${enable ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      logger.error(`Failed to toggle WinRM GPO`, error as Error);
      throw new ExternalServiceError('AD Service', 'Failed to toggle WinRM GPO', error as Error);
    }
  }

  private filterUsers(users: ADUser[], filter: UserFilter): ADUser[] {
    return users.filter(user => {
      const matchesSearch = !filter.searchQuery ||
        user.samAccountName.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        user.displayName.toLowerCase().includes(filter.searchQuery.toLowerCase());
      
      const matchesDepartment = !filter.department || user.department === filter.department;
      
      const matchesGroup = !filter.group || user.groups.includes(filter.group);
      
      return matchesSearch && matchesDepartment && matchesGroup;
    });
  }
}
