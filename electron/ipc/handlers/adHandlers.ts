/**
 * AD IPC Handlers
 */

import { ipcMain } from 'electron';
import { IPCChannels } from '../../../src/infrastructure/ipc/channels';
import { ADUser } from '../../../src/shared/types';

const { MOCK_AD_USERS, APPLOCKER_GROUPS } = require('../../constants.cjs');

export function setupADHandlers(): void {
  ipcMain.handle(IPCChannels.AD.GET_USERS, async (): Promise<ADUser[]> => {
    return MOCK_AD_USERS;
  });

  ipcMain.handle(IPCChannels.AD.GET_USER_BY_ID, async (_event, id: string): Promise<ADUser | null> => {
    const users = MOCK_AD_USERS;
    return users.find(u => u.id === id) || null;
  });

  ipcMain.handle(IPCChannels.AD.ADD_TO_GROUP, async (_event, userId: string, groupName: string): Promise<void> => {
    console.log(`Adding user ${userId} to group ${groupName}`);
    // In production, this would modify AD group membership via PowerShell
  });

  ipcMain.handle(IPCChannels.AD.REMOVE_FROM_GROUP, async (_event, userId: string, groupName: string): Promise<void> => {
    console.log(`Removing user ${userId} from group ${groupName}`);
    // In production, this would modify AD group membership via PowerShell
  });

  ipcMain.handle(IPCChannels.AD.GET_GROUPS, async (): Promise<string[]> => {
    return APPLOCKER_GROUPS;
  });

  ipcMain.handle(IPCChannels.AD.GET_WINRM_GPO_STATUS, async (): Promise<{ status: 'Enabled' | 'Disabled' | 'Processing' }> => {
    return { status: 'Enabled' };
  });

  ipcMain.handle(IPCChannels.AD.TOGGLE_WINRM_GPO, async (_event, enable: boolean): Promise<void> => {
    console.log(`${enable ? 'Enabling' : 'Disabling'} WinRM GPO`);
    // In production, this would create/modify GPO via PowerShell
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 3000);
    });
  });
}
