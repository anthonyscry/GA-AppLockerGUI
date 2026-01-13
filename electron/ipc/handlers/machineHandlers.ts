/**
 * Machine IPC Handlers
 * Handles IPC requests for machine operations
 */

import { ipcMain } from 'electron';
import { IPCChannels } from '../../../src/infrastructure/ipc/channels';
import { MachineScan } from '../../../src/shared/types';

const { MOCK_MACHINES } = require('../../constants.cjs');

/**
 * Setup machine IPC handlers
 */
export function setupMachineHandlers(): void {
  // Get all machines
  ipcMain.handle(IPCChannels.MACHINE.GET_ALL, async (): Promise<MachineScan[]> => {
    // In production, this would call PowerShell scripts or query a database
    // For now, return mock data
    return MOCK_MACHINES;
  });

  // Get machine by ID
  ipcMain.handle(IPCChannels.MACHINE.GET_BY_ID, async (_event, id: string): Promise<MachineScan | null> => {
    const machines = MOCK_MACHINES;
    return machines.find(m => m.id === id) || null;
  });

  // Start batch scan
  ipcMain.handle(IPCChannels.MACHINE.START_SCAN, async (_event, options: unknown): Promise<void> => {
    // In production, this would trigger WinRM scan via PowerShell
    console.log('Starting batch scan with options:', options);
    // Simulate async operation
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Batch scan completed');
        resolve();
      }, 2000);
    });
  });
}
