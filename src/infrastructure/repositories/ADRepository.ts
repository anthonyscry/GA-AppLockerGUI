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
      const result = await ipcClient.invoke<ADUser[] | { error: string; errorType?: string }>(IPCChannels.AD.GET_USERS);

      // Check if the result is an error response from PowerShell
      if (result && typeof result === 'object' && 'error' in result) {
        const errorMsg = (result as { error: string }).error;
        const errorType = (result as { errorType?: string }).errorType || 'Unknown';
        logger.error(`AD query failed: ${errorMsg} (${errorType})`);
        throw new ExternalServiceError('Active Directory', errorMsg, new Error(errorMsg));
      }

      const users = result as ADUser[];
      return users || [];
    } catch (error) {
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning empty users list');
        return [];
      }
      // Re-throw ExternalServiceError as-is
      if (error instanceof ExternalServiceError) {
        throw error;
      }
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
      // Null-safe property access to prevent crashes on undefined properties
      const samAccountName = user?.samAccountName || '';
      const displayName = user?.displayName || '';
      const department = user?.department || '';
      const groups = user?.groups || [];

      const searchQuery = filter?.searchQuery?.toLowerCase() || '';

      const matchesSearch = !searchQuery ||
        samAccountName.toLowerCase().includes(searchQuery) ||
        displayName.toLowerCase().includes(searchQuery);

      const matchesDepartment = !filter.department || department === filter.department;

      const matchesGroup = !filter.group || (Array.isArray(groups) && groups.includes(filter.group));

      return matchesSearch && matchesDepartment && matchesGroup;
    });
  }
}
