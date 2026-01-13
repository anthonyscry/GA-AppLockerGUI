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
  // Check if ipcMain is available (only available in Electron main process)
  if (!ipcMain) {
    console.warn('[IPC] ipcMain not available, skipping IPC handler setup');
    return;
  }

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

  // Policy merger handler
  ipcMain.handle('policy:mergePolicies', async (event, policyPaths, outputPath, options = {}) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Merge-AppLockerPolicies.ps1');
      const args = [
        '-PolicyPaths', ...policyPaths,
        '-OutputPath', outputPath
      ];

      if (options.conflictResolution) {
        args.push('-ConflictResolution', options.conflictResolution);
      }

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes
      });

      return {
        success: true,
        output: result.stdout,
        outputPath: outputPath
      };
    } catch (error) {
      console.error('[IPC] Policy merge error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Import artifacts handler (for rule generator)
  ipcMain.handle('policy:importArtifacts', async (event, artifactsPath) => {
    try {
      const fs = require('fs');
      const artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
      
      // Convert artifacts to inventory format
      const inventory = [];
      
      if (artifacts.Executables) {
        artifacts.Executables.forEach((exe, index) => {
          inventory.push({
            id: `exe-${index}`,
            name: exe.Name || exe.name || 'Unknown',
            publisher: exe.Publisher || exe.publisher || 'Unknown',
            path: exe.Path || exe.path || '',
            version: exe.Version || exe.version || '',
            type: (exe.Type || exe.type || 'EXE')
          });
        });
      }
      
      if (artifacts.WritablePaths) {
        artifacts.WritablePaths.forEach((exe, index) => {
          inventory.push({
            id: `writable-${index}`,
            name: exe.Name || exe.name || 'Unknown',
            publisher: 'Unknown',
            path: exe.Path || exe.path || '',
            version: '',
            type: 'EXE'
          });
        });
      }
      
      // Remove duplicates by path
      const uniqueInventory = inventory.filter((item, index, self) =>
        index === self.findIndex(t => t.path === item.path && t.path !== '')
      );
      
      return {
        success: true,
        inventory: uniqueInventory,
        count: uniqueInventory.length
      };
    } catch (error) {
      console.error('[IPC] Import artifacts error:', error);
      return {
        success: false,
        error: error.message,
        inventory: []
      };
    }
  });

  // Comprehensive artifact collection handler
  ipcMain.handle('policy:generateFromArtifacts', async (event, computerName, outputPath, options = {}) => {
    try {
      const artifactScriptPath = path.join(scriptsDir, 'Get-ComprehensiveScanArtifacts.ps1');
      const artifactArgs = [
        '-ComputerName', computerName || process.env.COMPUTERNAME || 'localhost',
        '-OutputPath', outputPath
      ];

      if (options.includeEventLogs) {
        artifactArgs.push('-IncludeEventLogs');
      }

      if (options.includeWritablePaths) {
        artifactArgs.push('-IncludeWritablePaths');
      }

      if (options.includeSystemPaths !== false) {
        artifactArgs.push('-IncludeSystemPaths');
      }

      // First collect artifacts
      const artifactResult = await executePowerShellScript(artifactScriptPath, artifactArgs, {
        timeout: 600000 // 10 minutes for comprehensive scan
      });

      // Then generate rules from artifacts using smart priority script
      const ruleScriptPath = path.join(scriptsDir, 'Generate-RulesFromArtifacts.ps1');
      const ruleOutputPath = options.ruleOutputPath || outputPath.replace('.json', '_rules.xml');
      const ruleArgs = [
        '-ArtifactsPath', outputPath,
        '-OutputPath', ruleOutputPath
      ];

      if (options.ruleType) {
        ruleArgs.push('-RuleType', options.ruleType);
      }

      if (options.collectionType) {
        ruleArgs.push('-CollectionType', options.collectionType);
      }

      if (options.mergeWithExisting && options.existingPolicyPath) {
        ruleArgs.push('-MergeWithExisting');
        ruleArgs.push('-ExistingPolicyPath', options.existingPolicyPath);
      }

      const ruleResult = await executePowerShellScript(ruleScriptPath, ruleArgs, {
        timeout: 600000 // 10 minutes
      });

      return {
        success: true,
        artifactsPath: outputPath,
        rulesPath: ruleOutputPath,
        artifactsOutput: artifactResult.stdout,
        rulesOutput: ruleResult.stdout
      };
    } catch (error) {
      console.error('[IPC] Generate from artifacts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Batch rule generation handler
  ipcMain.handle('policy:batchGenerateRules', async (event, inventoryItems, outputPath, options = {}) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Generate-BatchRules.ps1');
      const tempJsonPath = path.join(require('os').tmpdir(), `batch-inventory-${Date.now()}.json`);
      
      // Write inventory to temp JSON
      fs.writeFileSync(tempJsonPath, JSON.stringify(inventoryItems), 'utf8');
      
      // Build PowerShell command with parameters
      let psCommand = `$items = Get-Content '${tempJsonPath}' -Raw | ConvertFrom-Json; & '${scriptPath}' -InventoryItems $items -OutputPath '${outputPath}'`;
      
      if (options.ruleAction) {
        psCommand += ` -RuleAction '${options.ruleAction}'`;
      }
      if (options.targetGroup) {
        psCommand += ` -TargetGroup '${options.targetGroup}'`;
      }
      if (options.collectionType) {
        psCommand += ` -CollectionType '${options.collectionType}'`;
      }
      if (options.groupByPublisher !== false) {
        psCommand += ' -GroupByPublisher';
      }
      
      // Execute via PowerShell command
      const result = await executePowerShellCommand(psCommand, {
        timeout: 600000 // 10 minutes
      });
      
      // Clean up temp file
      try { fs.unlinkSync(tempJsonPath); } catch (e) {}
      
      return {
        success: true,
        output: result.stdout,
        outputPath: outputPath
      };
    } catch (error) {
      console.error('[IPC] Batch generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Publisher grouping handler
  ipcMain.handle('policy:groupByPublisher', async (event, inventoryItems) => {
    try {
      const groups = {};
      
      inventoryItems.forEach(item => {
        const publisher = item.Publisher || item.publisher || 'Unknown';
        if (!groups[publisher]) {
          groups[publisher] = [];
        }
        groups[publisher].push(item);
      });
      
      return {
        success: true,
        groups: groups,
        groupCount: Object.keys(groups).length,
        totalItems: inventoryItems.length
      };
    } catch (error) {
      console.error('[IPC] Publisher grouping error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Duplicate detection handler
  ipcMain.handle('policy:detectDuplicates', async (event, inventoryItems, policyPath, outputPath) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Detect-DuplicateRules.ps1');
      const tempJsonPath = path.join(require('os').tmpdir(), `duplicate-check-${Date.now()}.json`);
      
      fs.writeFileSync(tempJsonPath, JSON.stringify(inventoryItems), 'utf8');
      
      const args = [
        '-InventoryItems', `(Get-Content '${tempJsonPath}' | ConvertFrom-Json)`,
        '-OutputPath', outputPath
      ];
      
      if (policyPath) {
        args.push('-PolicyPath', policyPath);
      }
      
      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes
      });
      
      try { fs.unlinkSync(tempJsonPath); } catch (e) {}
      
      return {
        success: true,
        output: result.stdout,
        reportPath: outputPath
      };
    } catch (error) {
      console.error('[IPC] Duplicate detection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Incremental update handler
  ipcMain.handle('policy:getIncrementalUpdate', async (event, newInventory, existingPolicyPath, outputPath) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Get-IncrementalPolicyUpdate.ps1');
      const tempJsonPath = path.join(require('os').tmpdir(), `incremental-${Date.now()}.json`);
      
      fs.writeFileSync(tempJsonPath, JSON.stringify(newInventory), 'utf8');
      
      const args = [
        '-NewInventory', `(Get-Content '${tempJsonPath}' | ConvertFrom-Json)`,
        '-ExistingPolicyPath', existingPolicyPath,
        '-OutputPath', outputPath
      ];
      
      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes
      });
      
      try { fs.unlinkSync(tempJsonPath); } catch (e) {}
      
      return {
        success: true,
        output: result.stdout,
        deltaPath: outputPath
      };
    } catch (error) {
      console.error('[IPC] Incremental update error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Rule validation handler
  ipcMain.handle('policy:validateRules', async (event, policyPath) => {
    try {
      const scriptPath = path.join(scriptsDir, 'Test-RuleHealth.ps1');
      const result = await executePowerShellScript(scriptPath, ['-PolicyPath', policyPath], {
        timeout: 120000 // 2 minutes
      });
      
      // Parse validation results
      try {
        const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return {
            success: true,
            validation: JSON.parse(jsonMatch[0])
          };
        }
      } catch (e) {}
      
      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      console.error('[IPC] Rule validation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Rule templates handler
  ipcMain.handle('policy:getRuleTemplates', async (event) => {
    return {
      success: true,
      templates: [
        {
          id: 'microsoft-all',
          name: 'Allow All Microsoft-Signed Software',
          description: 'Creates Publisher rule for all Microsoft Corporation signed executables',
          publisher: 'O=MICROSOFT CORPORATION*',
          action: 'Allow'
        },
        {
          id: 'ga-asi-internal',
          name: 'Allow All GA-ASI Internal Tools',
          description: 'Creates Publisher rule for GA-ASI signed software',
          publisher: 'O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.*',
          action: 'Allow'
        },
        {
          id: 'deny-unsigned-userdirs',
          name: 'Deny Unsigned Executables in User Directories',
          description: 'Denies all unsigned executables in user writable paths',
          path: '%USERPROFILE%\\*',
          action: 'Deny'
        },
        {
          id: 'allow-programfiles',
          name: 'Allow Program Files',
          description: 'Allows executables in Program Files directories',
          path: '%PROGRAMFILES%\\*',
          action: 'Allow'
        }
      ]
    };
  });

  // Generate from template handler
  ipcMain.handle('policy:generateFromTemplate', async (event, templateId, options = {}) => {
    try {
      // Get template from predefined list
      const templateList = [
        {
          id: 'microsoft-all',
          name: 'Allow All Microsoft-Signed Software',
          description: 'Creates Publisher rule for all Microsoft Corporation signed executables',
          publisher: 'O=MICROSOFT CORPORATION*',
          action: 'Allow'
        },
        {
          id: 'ga-asi-internal',
          name: 'Allow All GA-ASI Internal Tools',
          description: 'Creates Publisher rule for GA-ASI signed software',
          publisher: 'O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.*',
          action: 'Allow'
        },
        {
          id: 'deny-unsigned-userdirs',
          name: 'Deny Unsigned Executables in User Directories',
          description: 'Denies all unsigned executables in user writable paths',
          path: '%USERPROFILE%\\*',
          action: 'Deny'
        },
        {
          id: 'allow-programfiles',
          name: 'Allow Program Files',
          description: 'Allows executables in Program Files directories',
          path: '%PROGRAMFILES%\\*',
          action: 'Allow'
        }
      ];
      
      const template = templateList.find(t => t.id === templateId);
      
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }
      
      // Generate rule from template (simplified - would use GA-AppLocker module)
      return {
        success: true,
        template: template,
        rule: {
          name: template.name,
          action: template.action,
          type: template.publisher ? 'Publisher' : 'Path',
          value: template.publisher || template.path
        }
      };
    } catch (error) {
      console.error('[IPC] Template generation error:', error);
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
