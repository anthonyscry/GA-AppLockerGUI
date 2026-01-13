/**
 * IPC Handlers for GA-AppLocker Dashboard
 * Handles communication between renderer and main process
 */

const { ipcMain } = require('electron');
const {
  executePowerShellScript,
  executePowerShellCommand,
  getScriptsDirectory,
  checkPowerShellModule
} = require('./powerShellHandler.cjs');
const path = require('path');
const fs = require('fs');

/**
 * Setup IPC handlers for AppLocker operations
 */
function setupIpcHandlers() {
  const scriptsDir = getScriptsDirectory();

  // Policy handlers
  ipcMain.handle('policy:runHealthCheck', async (event, policyPath) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Test-RuleHealth.ps1');
      const args = policyPath ? ['-PolicyPath', policyPath] : [];
      
      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 120000 // 2 minutes
      });

      // Parse JSON output if available
      try {
        const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // If JSON parsing fails, return stdout
      }

      return {
        success: true,
        output: result.stdout,
        error: result.stderr
      };
    } catch (error) {
      console.error('[IPC] Policy health check error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('policy:generateBaseline', async (event, options = {}) => {
    try {
      // Import the module first
      const modulePath = path.join(scriptsDir, 'GA-AppLocker.psm1');
      
      const command = `
        Import-Module "${modulePath}" -Force -ErrorAction Stop;
        $policy = New-GAAppLockerBaselinePolicy -EnforcementMode "${options.enforcementMode || 'AuditOnly'}";
        $policy | Get-AppLockerPolicy -Xml | Out-String
      `;

      const result = await executePowerShellCommand(command, {
        timeout: 60000
      });

      return {
        success: true,
        xml: result.stdout
      };
    } catch (error) {
      console.error('[IPC] Generate baseline error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('policy:deploy', async (event, policyPath, gpoName, options = {}) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Deploy-AppLockerPolicy.ps1');
      const args = [
        '-PolicyPath', policyPath,
        '-GPOName', gpoName
      ];

      if (options.backupPath) {
        args.push('-BackupPath', options.backupPath);
      }

      if (options.domain) {
        args.push('-Domain', options.domain);
      }

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes for GPO operations
      });

      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      console.error('[IPC] Policy deployment error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('policy:generateFromInventory', async (event, inventoryPath, outputPath, options = {}) => {
    try {
      const scriptPath = path.join(scriptsDir, 'New-RulesFromInventory.ps1');
      const args = [
        '-InventoryPath', inventoryPath,
        '-OutputPath', outputPath
      ];

      if (options.ruleType) {
        args.push('-RuleType', options.ruleType);
      }

      if (options.collectionType) {
        args.push('-CollectionType', options.collectionType);
      }

      if (options.mergeWithExisting && options.existingPolicyPath) {
        args.push('-MergeWithExisting');
        args.push('-ExistingPolicyPath', options.existingPolicyPath);
      }

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 600000 // 10 minutes for rule generation
      });

      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      console.error('[IPC] Generate from inventory error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Event handlers
  ipcMain.handle('events:collectAuditLogs', async (event, options = {}) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Get-AppLockerAuditLogs.ps1');
      const args = [];

      if (options.computerName) {
        args.push('-ComputerName');
        if (Array.isArray(options.computerName)) {
          args.push(...options.computerName);
        } else {
          args.push(options.computerName);
        }
      }

      if (options.startTime) {
        args.push('-StartTime', options.startTime.toISOString());
      }

      if (options.endTime) {
        args.push('-EndTime', options.endTime.toISOString());
      }

      if (options.outputPath) {
        args.push('-OutputPath', options.outputPath);
      }

      if (options.exportToSIEM) {
        args.push('-ExportToSIEM');
      }

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes
      });

      // Try to parse CSV output if available
      let events = [];
      if (options.outputPath && fs.existsSync(options.outputPath)) {
        try {
          const csvContent = fs.readFileSync(options.outputPath, 'utf8');
          // Simple CSV parsing (in production, use a CSV library)
          const lines = csvContent.split('\n').filter(l => l.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(',');
            events = lines.slice(1).map(line => {
              const values = line.split(',');
              const event = {};
              headers.forEach((header, index) => {
                event[header.trim()] = values[index]?.trim() || '';
              });
              return event;
            });
          }
        } catch (e) {
          console.warn('[IPC] Could not parse CSV output:', e);
        }
      }

      return {
        success: true,
        output: result.stdout,
        events: events,
        outputPath: options.outputPath
      };
    } catch (error) {
      console.error('[IPC] Collect audit logs error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Compliance handlers
  ipcMain.handle('compliance:generateReport', async (event, options = {}) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Get-ComplianceReport.ps1');
      const args = [
        '-OutputDirectory', options.outputDirectory || path.join(process.cwd(), 'compliance')
      ];

      if (options.policyPath) {
        args.push('-PolicyPath', options.policyPath);
      }

      if (options.reportFormat) {
        args.push('-ReportFormat', options.reportFormat);
      }

      if (options.includeEvidence) {
        args.push('-IncludeEvidence');
      }

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes
      });

      return {
        success: true,
        output: result.stdout,
        outputDirectory: options.outputDirectory
      };
    } catch (error) {
      console.error('[IPC] Generate compliance report error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // System handlers
  ipcMain.handle('system:checkAppLockerService', async (event) => {
    try {
      const command = 'Get-Service -Name AppIDSvc | Select-Object Status, StartType | ConvertTo-Json';
      const result = await executePowerShellCommand(command, {
        timeout: 10000
      });

      const serviceInfo = JSON.parse(result.stdout);
      return {
        success: true,
        status: serviceInfo.Status,
        startType: serviceInfo.StartType,
        isRunning: serviceInfo.Status === 'Running',
        isAutomatic: serviceInfo.StartType === 'Automatic'
      };
    } catch (error) {
      console.error('[IPC] Check AppLocker service error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('system:checkPowerShellModules', async (event) => {
    try {
      const modules = ['AppLocker', 'GroupPolicy'];
      const results = {};

      for (const module of modules) {
        results[module] = await checkPowerShellModule(module);
      }

      return {
        success: true,
        modules: results
      };
    } catch (error) {
      console.error('[IPC] Check PowerShell modules error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Utility handlers
  ipcMain.handle('util:getScriptsDirectory', async (event) => {
    return {
      success: true,
      path: getScriptsDirectory()
    };
  });

  console.log('[IPC] IPC handlers registered successfully');
}

module.exports = {
  setupIpcHandlers
};
