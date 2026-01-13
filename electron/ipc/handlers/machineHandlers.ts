/**
 * Machine IPC Handlers
 * Handles IPC requests for machine operations
 */

import { ipcMain } from 'electron';
import { IPCChannels } from '../../../src/infrastructure/ipc/channels';
import { MachineScan } from '../../../src/shared/types';
import * as path from 'path';

const { MOCK_MACHINES } = require('../../constants.cjs');
const { executePowerShellScript, getScriptsDirectory } = require('../powerShellHandler.cjs');

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
  ipcMain.handle(IPCChannels.MACHINE.START_SCAN, async (_event, options: any): Promise<void> => {
    const scriptsDir = getScriptsDirectory();
    
    console.log('Starting batch scan with options:', JSON.stringify({
      ...options,
      credentials: options.credentials ? {
        ...options.credentials,
        password: options.credentials.password ? '***REDACTED***' : undefined
      } : undefined
    }));
    
    try {
      const scanScriptPath = path.join(scriptsDir, 'Start-BatchScan.ps1');
      const args: string[] = [];
      
      // Add target OUs if specified
      if (options.targetOUs && options.targetOUs.length > 0) {
        args.push('-TargetOUs');
        args.push(...options.targetOUs);
      }
      
      // Add credentials
      if (options.credentials) {
        if (options.credentials.useCurrentUser) {
          args.push('-UseCurrentUser');
        } else {
          if (options.credentials.username) {
            args.push('-Username', options.credentials.username);
          }
          if (options.credentials.password) {
            args.push('-Password', options.credentials.password);
          }
          if (options.credentials.domain) {
            args.push('-Domain', options.credentials.domain);
          }
        }
      } else {
        args.push('-UseCurrentUser');
      }
      
      // Add scan options
      if (options.includeEventLogs) {
        args.push('-IncludeEventLogs');
      }
      if (options.includeWritablePaths) {
        args.push('-IncludeWritablePaths');
      }
      
      // Execute batch scan
      const result = await executePowerShellScript(scanScriptPath, args, {
        timeout: options.timeout || 600000 // 10 minutes default
      });
      
      console.log('Batch scan completed:', result.stdout);
    } catch (error) {
      console.error('[IPC] Batch scan error:', error);
      throw error;
    }
  });
}
