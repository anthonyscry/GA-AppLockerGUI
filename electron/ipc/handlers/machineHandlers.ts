/**
 * Machine IPC Handlers
 * Handles IPC requests for machine operations
 */

import { ipcMain } from 'electron';
import { IPCChannels } from '../../../src/infrastructure/ipc/channels';
import { MachineScan } from '../../../src/shared/types';
import * as path from 'path';
import * as crypto from 'crypto';

const { MOCK_MACHINES } = require('../../constants.cjs');
const { executePowerShellScript, getScriptsDirectory } = require('../powerShellHandler.cjs');

/**
 * Validate OU path format to prevent injection
 */
function isValidOUPath(ouPath: string): boolean {
  if (typeof ouPath !== 'string' || ouPath.length === 0 || ouPath.length > 2048) {
    return false;
  }
  // OU paths should follow LDAP DN format: OU=...,DC=...,DC=...
  // Allow alphanumeric, spaces, commas, equals, and backslashes
  const validPattern = /^[a-zA-Z0-9\s,=\\.-]+$/;
  return validPattern.test(ouPath);
}

/**
 * Validate username format
 */
function isValidUsername(username: string): boolean {
  if (typeof username !== 'string' || username.length === 0 || username.length > 256) {
    return false;
  }
  // Username: domain\user or user@domain or just user
  const validPattern = /^[a-zA-Z0-9._\\@-]+$/;
  return validPattern.test(username);
}

/**
 * Validate domain name format
 */
function isValidDomain(domain: string): boolean {
  if (typeof domain !== 'string' || domain.length === 0 || domain.length > 256) {
    return false;
  }
  // Domain: NETBIOS name or FQDN
  const validPattern = /^[a-zA-Z0-9.-]+$/;
  return validPattern.test(domain);
}

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
    return machines.find((m: MachineScan) => m.id === id) || null;
  });

  // Start batch scan
  ipcMain.handle(IPCChannels.MACHINE.START_SCAN, async (_event, options: any): Promise<void> => {
    const scriptsDir = getScriptsDirectory();

    // SECURITY: Never log credentials, not even redacted placeholders
    console.log('Starting batch scan with options:', JSON.stringify({
      targetOUs: options.targetOUs,
      includeEventLogs: options.includeEventLogs,
      includeWritablePaths: options.includeWritablePaths,
      useCurrentUser: options.credentials?.useCurrentUser ?? true
    }));

    try {
      const scanScriptPath = path.join(scriptsDir, 'Start-BatchScan.ps1');
      const args: string[] = [];
      // Filter out undefined values from process.env
      const env: Record<string, string> = Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
      );

      // Validate and add target OUs if specified
      if (options.targetOUs && options.targetOUs.length > 0) {
        // Validate each OU path
        for (const ou of options.targetOUs) {
          if (!isValidOUPath(ou)) {
            throw new Error(`Invalid OU path format: ${ou.substring(0, 50)}...`);
          }
        }
        args.push('-TargetOUs');
        args.push(...options.targetOUs);
      }

      // Add credentials securely
      if (options.credentials) {
        if (options.credentials.useCurrentUser) {
          args.push('-UseCurrentUser');
        } else {
          // Validate username and domain
          if (options.credentials.username) {
            if (!isValidUsername(options.credentials.username)) {
              throw new Error('Invalid username format');
            }
            args.push('-Username', options.credentials.username);
          }

          // SECURITY: Pass password via environment variable, not command line
          // This prevents password from appearing in process listings
          if (options.credentials.password) {
            const envVarName = `SCAN_CRED_${crypto.randomBytes(8).toString('hex')}`;
            env[envVarName] = options.credentials.password;
            args.push('-PasswordEnvVar', envVarName);
          }

          if (options.credentials.domain) {
            if (!isValidDomain(options.credentials.domain)) {
              throw new Error('Invalid domain format');
            }
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

      // Execute batch scan with custom environment
      await executePowerShellScript(scanScriptPath, args, {
        timeout: options.timeout || 600000, // 10 minutes default
        env: env
      });

      console.log('Batch scan completed successfully');
      // Don't log stdout which may contain sensitive scan results
    } catch (error) {
      console.error('[IPC] Batch scan error:', (error as Error).message);
      throw error;
    }
  });
}
