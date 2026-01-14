/**
 * IPC Handlers for GA-AppLocker Dashboard
 * Handles communication between renderer and main process
 *
 * ============================================================================
 * LESSONS LEARNED - CRITICAL PATTERNS FOR POWERSHELL IPC
 * ============================================================================
 *
 * 1. ALWAYS IMPORT MODULES EXPLICITLY
 *    PowerShell via Node.js child_process does NOT auto-load modules.
 *    Every command using AD or GPO cmdlets MUST start with:
 *      Import-Module ActiveDirectory -ErrorAction Stop
 *      Import-Module GroupPolicy -ErrorAction Stop
 *
 * 2. NEVER SILENTLY RETURN EMPTY ARRAYS ON ERRORS
 *    BAD:  catch (e) { return []; }  // Hides errors from user
 *    GOOD: catch (e) { return { error: e.message }; }  // UI can display
 *
 * 3. USE STRUCTURED ERROR RESPONSES
 *    PowerShell should return JSON like:
 *      Success: { "success": true, "data": [...] }
 *      Failure: { "success": false, "error": "message", "errorType": "Type" }
 *
 * 4. GPO CREATION REQUIRES LINKING
 *    New-GPO alone does NOTHING. Must also call:
 *      New-GPLink -Name $gpoName -Target $domainDN -LinkEnabled Yes
 *
 * See docs/LESSONS_LEARNED.md for full documentation.
 * ============================================================================
 */

const { ipcMain, dialog } = require('electron');
const {
  executePowerShellScript,
  executePowerShellCommand,
  getScriptsDirectory,
  checkPowerShellModule,
  escapePowerShellString
} = require('./powerShellHandler.cjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DEFAULT_EVENTS_BACKUP_ROOT = 'C:\\AppLocker\\backups\\events';

/**
 * Allowed enforcement modes for policy generation (whitelist)
 */
const ALLOWED_ENFORCEMENT_MODES = ['AuditOnly', 'Enabled', 'NotConfigured'];

/**
 * Allowed rule actions (whitelist)
 */
const ALLOWED_RULE_ACTIONS = ['Allow', 'Deny'];

/**
 * Allowed collection types (whitelist)
 */
const ALLOWED_COLLECTION_TYPES = ['Exe', 'Msi', 'Script', 'Dll', 'Appx'];

/**
 * Validate that a path is within allowed directories
 * Prevents path traversal attacks
 */
function isPathAllowed(filePath, allowedRoots = null) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }

  // Normalize the path to resolve .. and . components
  const normalizedPath = path.resolve(filePath);

  // Check for null bytes (path injection)
  if (filePath.includes('\0')) {
    return false;
  }

  // Default allowed roots (Windows AppLocker management paths)
  const defaultAllowedRoots = [
    process.cwd(),
    require('os').tmpdir(),
    require('os').homedir(),
    path.join(require('os').homedir(), 'Documents'),
    path.join(require('os').homedir(), 'AppData'),
    'C:\\AppLocker',
    'C:\\AppLockerBackups',
    'C:\\AppLockerEvidence'
  ];

  const roots = allowedRoots || defaultAllowedRoots;

  // Check if path is under any allowed root
  return roots.some(root => {
    const normalizedRoot = path.resolve(root);
    return normalizedPath.startsWith(normalizedRoot);
  });
}

/**
 * Validate string against allowed values (enum validation)
 */
function validateEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new Error(`Invalid ${fieldName}: must be one of ${allowedValues.join(', ')}`);
  }
  return value;
}

/**
 * Generate a secure random filename for temp files
 */
function generateSecureTempFilename(prefix = 'temp', extension = '.json') {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${prefix}-${randomBytes}${extension}`;
}

/**
 * Sanitize error message for client response
 * Removes sensitive path information
 */
function sanitizeErrorMessage(error) {
  if (!error) return 'Unknown error occurred';
  const message = error.message || String(error);
  // Remove full file paths
  return message.replace(/[A-Z]:\\[^:]+/gi, '[PATH]')
                .replace(/\/[^:]+\/[^:]+/g, '[PATH]');
}

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
        error: sanitizeErrorMessage(error)
      };
    }
  });

  ipcMain.handle('policy:generateBaseline', async (event, options = {}) => {
    try {
      // Import the module first
      const modulePath = path.join(scriptsDir, 'GA-AppLocker.psm1');

      // Validate enforcement mode against whitelist to prevent injection
      const enforcementMode = options.enforcementMode || 'AuditOnly';
      validateEnum(enforcementMode, ALLOWED_ENFORCEMENT_MODES, 'enforcementMode');

      const command = `
        Import-Module "${escapePowerShellString(modulePath)}" -Force -ErrorAction Stop;
        $policy = New-GAAppLockerBaselinePolicy -EnforcementMode "${enforcementMode}";
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
        error: sanitizeErrorMessage(error)
      };
    }
  });

  ipcMain.handle('policy:deploy', async (event, policyPath, gpoName, options = {}) => {
    try {
      // SECURITY: Validate all paths
      if (!isPathAllowed(policyPath)) {
        return { success: false, error: 'Policy path not allowed' };
      }
      if (options.backupPath && !isPathAllowed(options.backupPath)) {
        return { success: false, error: 'Backup path not allowed' };
      }

      // SECURITY: Validate GPO name (alphanumeric, spaces, hyphens, underscores only)
      const gpoNamePattern = /^[a-zA-Z0-9\s\-_]+$/;
      if (!gpoName || !gpoNamePattern.test(gpoName)) {
        return { success: false, error: 'Invalid GPO name format' };
      }

      // SECURITY: Validate phase against whitelist
      const validPhases = ['1', '2', '3', '4', 'Phase1', 'Phase2', 'Phase3', 'Phase4'];
      if (options.phase && !validPhases.includes(options.phase)) {
        return { success: false, error: 'Invalid phase value' };
      }

      // SECURITY: Validate enforcement mode against whitelist
      const validModes = ['AuditOnly', 'Enabled', 'NotConfigured'];
      if (options.enforcementMode && !validModes.includes(options.enforcementMode)) {
        return { success: false, error: 'Invalid enforcement mode' };
      }

      // SECURITY: Validate domain format (alphanumeric, dots, hyphens)
      const domainPattern = /^[a-zA-Z0-9.\-]+$/;
      if (options.domain && !domainPattern.test(options.domain)) {
        return { success: false, error: 'Invalid domain format' };
      }

      const scriptPath = path.join(scriptsDir, 'Deploy-AppLockerPolicy.ps1');
      const args = [
        '-PolicyPath', escapePowerShellString(policyPath),
        '-GPOName', escapePowerShellString(gpoName)
      ];

      if (options.backupPath) {
        args.push('-BackupPath', escapePowerShellString(options.backupPath));
      }

      if (options.domain) {
        args.push('-Domain', escapePowerShellString(options.domain));
      }

      // SECURITY: Escape each OU path individually before joining
      if (options.ouPaths && Array.isArray(options.ouPaths) && options.ouPaths.length > 0) {
        const ouPathPattern = /^[a-zA-Z0-9\s,=\\.\-]+$/;
        for (const ouPath of options.ouPaths) {
          if (!ouPathPattern.test(ouPath)) {
            return { success: false, error: 'Invalid OU path format' };
          }
        }
        args.push('-OUPath', ...options.ouPaths.map(p => escapePowerShellString(p)));
      } else if (options.ouPaths) {
        return { success: false, error: 'At least one valid OU path is required to link the GPO' };
      }

      if (options.phase) {
        args.push('-Phase', options.phase);
      }

      if (options.enforcementMode) {
        args.push('-EnforcementMode', options.enforcementMode);
      }

      if (options.createGPO) {
        args.push('-CreateGPO');
      }

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes for GPO operations
      });

      // Try to parse JSON output from script
      try {
        const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // If JSON parsing fails, return raw output
      }

      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      console.error('[IPC] Policy deployment error:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    }
  });

  ipcMain.handle('policy:generateFromInventory', async (event, inventoryPath, outputPath, options = {}) => {
    try {
      // SECURITY: Validate all paths
      if (!isPathAllowed(inventoryPath)) {
        return { success: false, error: 'Inventory path not allowed' };
      }
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }
      if (options.existingPolicyPath && !isPathAllowed(options.existingPolicyPath)) {
        return { success: false, error: 'Existing policy path not allowed' };
      }

      // SECURITY: Validate ruleType against whitelist
      const validRuleTypes = ['Publisher', 'Hash', 'Path'];
      if (options.ruleType && !validRuleTypes.includes(options.ruleType)) {
        return { success: false, error: 'Invalid rule type' };
      }

      // SECURITY: Validate collectionType against whitelist
      const validCollectionTypes = ['Exe', 'Msi', 'Script', 'Appx', 'Dll'];
      if (options.collectionType && !validCollectionTypes.includes(options.collectionType)) {
        return { success: false, error: 'Invalid collection type' };
      }

      const scriptPath = path.join(scriptsDir, 'New-RulesFromInventory.ps1');
      const args = [
        '-InventoryPath', escapePowerShellString(inventoryPath),
        '-OutputPath', escapePowerShellString(outputPath)
      ];

      if (options.ruleType) {
        args.push('-RuleType', options.ruleType);
      }

      if (options.collectionType) {
        args.push('-CollectionType', options.collectionType);
      }

      if (options.mergeWithExisting && options.existingPolicyPath) {
        args.push('-MergeWithExisting');
        args.push('-ExistingPolicyPath', escapePowerShellString(options.existingPolicyPath));
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
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Event handlers
  ipcMain.handle('events:collectAuditLogs', async (event, options = {}) => {
    try {
      // SECURITY: Validate output path if provided
      if (options.outputPath && !isPathAllowed(options.outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      // SECURITY: Validate computer name format (alphanumeric, hyphens, dots)
      const computerNamePattern = /^[a-zA-Z0-9.\-]+$/;
      if (options.computerName) {
        const names = Array.isArray(options.computerName) ? options.computerName : [options.computerName];
        for (const name of names) {
          if (!computerNamePattern.test(name)) {
            return { success: false, error: 'Invalid computer name format' };
          }
        }
      }

      const scriptPath = path.join(scriptsDir, 'Get-AppLockerAuditLogs.ps1');
      const args = [];

      if (options.computerName) {
        args.push('-ComputerName');
        if (Array.isArray(options.computerName)) {
          // SECURITY: Escape each computer name
          args.push(...options.computerName.map(n => escapePowerShellString(n)));
        } else {
          args.push(escapePowerShellString(options.computerName));
        }
      }

      if (options.startTime) {
        args.push('-StartTime', options.startTime.toISOString());
      }

      if (options.endTime) {
        args.push('-EndTime', options.endTime.toISOString());
      }

      if (options.outputPath) {
        args.push('-OutputPath', escapePowerShellString(options.outputPath));
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
          // Secure CSV parsing with validation
          const lines = csvContent.split('\n').filter(l => l.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.trim());

            // SECURITY: Validate headers to prevent prototype pollution
            const forbiddenHeaders = ['__proto__', 'constructor', 'prototype'];
            const sanitizedHeaders = headers.map(header => {
              if (forbiddenHeaders.includes(header.toLowerCase())) {
                console.warn(`[IPC] Blocked potentially dangerous CSV header: ${header}`);
                return `_blocked_${header}`;
              }
              // Only allow alphanumeric, spaces, underscores, hyphens
              if (!/^[a-zA-Z0-9\s_-]+$/.test(header)) {
                return header.replace(/[^a-zA-Z0-9\s_-]/g, '_');
              }
              return header;
            });

            events = lines.slice(1).map(line => {
              // Handle quoted values in CSV (basic support)
              const values = [];
              let current = '';
              let inQuotes = false;
              for (const char of line) {
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  values.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              values.push(current.trim());

              // Build event object with sanitized headers
              const event = Object.create(null); // No prototype chain
              sanitizedHeaders.forEach((header, index) => {
                event[header] = values[index]?.trim() || '';
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
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Compliance handlers
  ipcMain.handle('compliance:generateReport', async (event, options = {}) => {
    try {
      // SECURITY: Validate output directory path
      const outputDir = options.outputDirectory || path.join(process.cwd(), 'compliance');
      if (!isPathAllowed(outputDir)) {
        return { success: false, error: 'Output directory not allowed' };
      }

      // SECURITY: Validate policy path if provided
      if (options.policyPath && !isPathAllowed(options.policyPath)) {
        return { success: false, error: 'Policy path not allowed' };
      }

      // SECURITY: Validate report format against whitelist
      const validFormats = ['HTML', 'JSON', 'CSV', 'XML'];
      if (options.reportFormat && !validFormats.includes(options.reportFormat)) {
        return { success: false, error: 'Invalid report format' };
      }

      const scriptPath = path.join(scriptsDir, 'Get-ComplianceReport.ps1');
      const args = [
        '-OutputDirectory', escapePowerShellString(outputDir)
      ];

      if (options.policyPath) {
        args.push('-PolicyPath', escapePowerShellString(options.policyPath));
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
        outputDirectory: outputDir
      };
    } catch (error) {
      console.error('[IPC] Generate compliance report error:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // System handlers
  ipcMain.handle('system:getUserInfo', async (event) => {
    try {
      const os = require('os');
      const domain = process.env.USERDOMAIN || process.env.COMPUTERNAME || os.hostname() || 'WORKGROUP';
      const username = process.env.USERNAME || os.userInfo().username || 'user';

      return {
        success: true,
        principal: `${domain}\\${username}`,
        username: username,
        domain: domain,
        hostname: os.hostname(),
        branch: process.env.GIT_BRANCH || 'main'
      };
    } catch (error) {
      console.error('[IPC] Get user info error:', error);
      return {
        success: false,
        principal: 'Unknown\\User',
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Get detailed domain information (auto-detect from DC)
  ipcMain.handle('system:getDomainInfo', async (event) => {
    try {
      const os = require('os');
      
      // Try to get domain info via PowerShell (works best on DC)
      const domainInfoCommand = `
        try {
          $domain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
          $forest = [System.DirectoryServices.ActiveDirectory.Forest]::GetCurrentForest()
          $computerSystem = Get-WmiObject Win32_ComputerSystem
          $isDC = ($computerSystem.DomainRole -ge 4)
          
          @{
            Success = $true
            DomainName = $domain.Name
            DomainNetBIOS = $env:USERDOMAIN
            ForestName = $forest.Name
            DomainControllers = @($domain.DomainControllers | Select-Object -ExpandProperty Name)
            CurrentDC = $env:LOGONSERVER -replace '\\\\\\\\', ''
            IsDomainController = $isDC
            ComputerName = $env:COMPUTERNAME
            UserName = $env:USERNAME
            UserDomain = $env:USERDOMAIN
            FQDN = "$env:COMPUTERNAME.$($domain.Name)"
          } | ConvertTo-Json -Compress
        } catch {
          @{
            Success = $false
            Error = $_.Exception.Message
            DomainName = $env:USERDOMAIN
            DomainNetBIOS = $env:USERDOMAIN
            IsDomainController = $false
            ComputerName = $env:COMPUTERNAME
            UserName = $env:USERNAME
          } | ConvertTo-Json -Compress
        }
      `;
      
      const result = await executePowerShellCommand(domainInfoCommand, { timeout: 10000 });
      
      if (result.stdout) {
        const domainInfo = JSON.parse(result.stdout.trim());
        return domainInfo;
      }
      
      // Fallback if PowerShell fails
      return {
        Success: false,
        DomainName: process.env.USERDOMAIN || os.hostname(),
        DomainNetBIOS: process.env.USERDOMAIN || os.hostname(),
        IsDomainController: false,
        ComputerName: os.hostname(),
        UserName: process.env.USERNAME || os.userInfo().username,
        Error: 'Could not query Active Directory'
      };
    } catch (error) {
      console.error('[IPC] Get domain info error:', error);
      const os = require('os');
      return {
        Success: false,
        DomainName: process.env.USERDOMAIN || 'WORKGROUP',
        DomainNetBIOS: process.env.USERDOMAIN || 'WORKGROUP',
        IsDomainController: false,
        ComputerName: os.hostname(),
        UserName: process.env.USERNAME || 'user',
        Error: sanitizeErrorMessage(error)
      };
    }
  });

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
        error: sanitizeErrorMessage(error)
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
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Policy merger handler
  ipcMain.handle('policy:mergePolicies', async (event, policyPaths, outputPath, options = {}) => {
    try {
      const payload = Array.isArray(policyPaths)
        ? { policyPaths, outputPath, options }
        : policyPaths;

      const validResolutions = ['First', 'Last', 'Strict'];
      const conflictResolution = payload?.options?.conflictResolution ?? options?.conflictResolution;
      if (conflictResolution && !validResolutions.includes(conflictResolution)) {
        return { success: false, error: 'Invalid conflict resolution option' };
      }

      const scriptPath = path.join(scriptsDir, 'Merge-AppLockerPolicies.ps1');

      const runMerge = async (policyPathsForMerge, outputPathForMerge) => {
        if (!isPathAllowed(outputPathForMerge)) {
          return { success: false, error: 'Output path not allowed', outputPath: outputPathForMerge };
        }
        if (!Array.isArray(policyPathsForMerge) || policyPathsForMerge.length === 0) {
          return { success: false, error: 'Policy paths array is required', outputPath: outputPathForMerge };
        }
        for (const pPath of policyPathsForMerge) {
          if (!isPathAllowed(pPath)) {
            return { success: false, error: 'One or more policy paths not allowed', outputPath: outputPathForMerge };
          }
        }

        const args = [
          '-PolicyPaths', ...policyPathsForMerge.map(p => escapePowerShellString(p)),
          '-OutputPath', escapePowerShellString(outputPathForMerge)
        ];

        if (conflictResolution) {
          args.push('-ConflictResolution', conflictResolution);
        }

        const result = await executePowerShellScript(scriptPath, args, {
          timeout: 300000 // 5 minutes
        });

        return {
          success: true,
          output: result.stdout,
          outputPath: outputPathForMerge
        };
      };

      if (payload?.machineTypeGroups) {
        const groupResults = {};
        const groupEntries = Object.entries(payload.machineTypeGroups);
        if (groupEntries.length === 0) {
          return { success: false, error: 'Machine type groups are required' };
        }

        for (const [machineType, group] of groupEntries) {
          groupResults[machineType] = await runMerge(group.policyPaths, group.outputPath);
        }

        return {
          success: true,
          groupedResults: groupResults
        };
      }

      return await runMerge(payload?.policyPaths ?? policyPaths, payload?.outputPath ?? outputPath);
    } catch (error) {
      console.error('[IPC] Policy merge error:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Import artifacts handler (for rule generator)
  ipcMain.handle('policy:importArtifacts', async (event, artifactsPath) => {
    try {
      // SECURITY: Validate artifacts path
      if (!isPathAllowed(artifactsPath)) {
        return { success: false, error: 'Artifacts path not allowed', inventory: [] };
      }

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
        error: sanitizeErrorMessage(error),
        inventory: []
      };
    }
  });

  // Comprehensive artifact collection handler
  ipcMain.handle('policy:generateFromArtifacts', async (event, computerName, outputPath, options = {}) => {
    try {
      // SECURITY: Validate output path
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      // SECURITY: Validate rule output path if provided
      if (options.ruleOutputPath && !isPathAllowed(options.ruleOutputPath)) {
        return { success: false, error: 'Rule output path not allowed' };
      }

      // SECURITY: Validate existing policy path if provided
      if (options.existingPolicyPath && !isPathAllowed(options.existingPolicyPath)) {
        return { success: false, error: 'Existing policy path not allowed' };
      }

      // SECURITY: Validate computer name format (alphanumeric, hyphens, dots)
      const computerNamePattern = /^[a-zA-Z0-9.\-]+$/;
      const safeComputerName = computerName || process.env.COMPUTERNAME || 'localhost';
      if (!computerNamePattern.test(safeComputerName)) {
        return { success: false, error: 'Invalid computer name format' };
      }

      // SECURITY: Validate ruleType against whitelist
      const validRuleTypes = ['Publisher', 'Hash', 'Path'];
      if (options.ruleType && !validRuleTypes.includes(options.ruleType)) {
        return { success: false, error: 'Invalid rule type' };
      }

      // SECURITY: Validate collectionType against whitelist
      const validCollectionTypes = ['Exe', 'Msi', 'Script', 'Appx', 'Dll'];
      if (options.collectionType && !validCollectionTypes.includes(options.collectionType)) {
        return { success: false, error: 'Invalid collection type' };
      }

      const artifactScriptPath = path.join(scriptsDir, 'Get-ComprehensiveScanArtifacts.ps1');
      const artifactArgs = [
        '-ComputerName', escapePowerShellString(safeComputerName),
        '-OutputPath', escapePowerShellString(outputPath)
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

      // SECURITY: Handle credentials securely - pass via environment variables, not command line
      // Note: Credentials should not be passed on command line; they are visible in process list
      // The script should use -Credential parameter with a PSCredential object instead
      if (options.credentials && !options.credentials.useCurrentUser) {
        // SECURITY: Validate domain format if provided
        if (options.credentials.domain) {
          const domainPattern = /^[a-zA-Z0-9.\-]+$/;
          if (!domainPattern.test(options.credentials.domain)) {
            return { success: false, error: 'Invalid domain format' };
          }
          artifactArgs.push('-Domain', escapePowerShellString(options.credentials.domain));
        }
        // SECURITY: Username validation
        if (options.credentials.username) {
          const usernamePattern = /^[a-zA-Z0-9._\-@\\]+$/;
          if (!usernamePattern.test(options.credentials.username)) {
            return { success: false, error: 'Invalid username format' };
          }
          artifactArgs.push('-Username', escapePowerShellString(options.credentials.username));
        }
        // Note: Password handling should be done via secure string, not command line
        // For now, we skip passing password directly - script should prompt or use cached credentials
      }

      // First collect artifacts
      const artifactResult = await executePowerShellScript(artifactScriptPath, artifactArgs, {
        timeout: 600000 // 10 minutes for comprehensive scan
      });

      // Then generate rules from artifacts using smart priority script
      const ruleScriptPath = path.join(scriptsDir, 'Generate-RulesFromArtifacts.ps1');
      const ruleOutputPath = options.ruleOutputPath || outputPath.replace('.json', '_rules.xml');
      const ruleArgs = [
        '-ArtifactsPath', escapePowerShellString(outputPath),
        '-OutputPath', escapePowerShellString(ruleOutputPath)
      ];

      if (options.ruleType) {
        ruleArgs.push('-RuleType', options.ruleType);
      }

      if (options.collectionType) {
        ruleArgs.push('-CollectionType', options.collectionType);
      }

      if (options.mergeWithExisting && options.existingPolicyPath) {
        ruleArgs.push('-MergeWithExisting');
        ruleArgs.push('-ExistingPolicyPath', escapePowerShellString(options.existingPolicyPath));
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
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Batch rule generation handler
  ipcMain.handle('policy:batchGenerateRules', async (event, inventoryItems, outputPath, options = {}) => {
    let tempJsonPath = null;
    try {
      // Validate output path
      if (!isPathAllowed(outputPath)) {
        throw new Error('Output path is not in an allowed directory');
      }

      const scriptPath = path.join(scriptsDir, 'Generate-BatchRules.ps1');
      // Use secure random filename to prevent prediction
      tempJsonPath = path.join(require('os').tmpdir(), generateSecureTempFilename('batch-inventory'));

      // Validate and sanitize options against whitelists
      const safeOptions = {};
      if (options.ruleAction) {
        safeOptions.ruleAction = validateEnum(options.ruleAction, ALLOWED_RULE_ACTIONS, 'ruleAction');
      }
      if (options.collectionType) {
        safeOptions.collectionType = validateEnum(options.collectionType, ALLOWED_COLLECTION_TYPES, 'collectionType');
      }
      // Sanitize target group - alphanumeric, spaces, hyphens, underscores only
      if (options.targetGroup) {
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(options.targetGroup)) {
          throw new Error('Invalid target group name: contains prohibited characters');
        }
        safeOptions.targetGroup = options.targetGroup;
      }

      // Write inventory to temp JSON
      fs.writeFileSync(tempJsonPath, JSON.stringify(inventoryItems), 'utf8');

      // Build safe argument array (not string concatenation)
      const args = [
        '-File', scriptPath,
        '-InventoryPath', tempJsonPath,
        '-OutputPath', outputPath
      ];

      if (safeOptions.ruleAction) {
        args.push('-RuleAction', safeOptions.ruleAction);
      }
      if (safeOptions.targetGroup) {
        args.push('-TargetGroup', safeOptions.targetGroup);
      }
      if (safeOptions.collectionType) {
        args.push('-CollectionType', safeOptions.collectionType);
      }
      if (options.groupByPublisher !== false) {
        args.push('-GroupByPublisher');
      }

      // Execute via PowerShell script with argument array (safer)
      const result = await executePowerShellScript(scriptPath, args.slice(2), {
        timeout: 600000 // 10 minutes
      });

      return {
        success: true,
        output: result.stdout,
        outputPath: outputPath
      };
    } catch (error) {
      console.error('[IPC] Batch generation error:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    } finally {
      // Always clean up temp file
      if (tempJsonPath) {
        try { fs.unlinkSync(tempJsonPath); } catch (e) {}
      }
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
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Duplicate detection handler
  ipcMain.handle('policy:detectDuplicates', async (event, inventoryItems, policyPath, outputPath) => {
    let tempJsonPath = null;
    try {
      // Validate output path
      if (!isPathAllowed(outputPath)) {
        throw new Error('Output path is not in an allowed directory');
      }
      // Validate policy path if provided
      if (policyPath && !isPathAllowed(policyPath)) {
        throw new Error('Policy path is not in an allowed directory');
      }

      const scriptPath = path.join(scriptsDir, 'Detect-DuplicateRules.ps1');
      tempJsonPath = path.join(require('os').tmpdir(), generateSecureTempFilename('duplicate-check'));

      fs.writeFileSync(tempJsonPath, JSON.stringify(inventoryItems), 'utf8');

      // Use argument array instead of string interpolation
      const args = [
        '-InventoryPath', tempJsonPath,
        '-OutputPath', outputPath
      ];

      if (policyPath) {
        args.push('-PolicyPath', policyPath);
      }

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes
      });

      return {
        success: true,
        output: result.stdout,
        reportPath: outputPath
      };
    } catch (error) {
      console.error('[IPC] Duplicate detection error:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    } finally {
      if (tempJsonPath) {
        try { fs.unlinkSync(tempJsonPath); } catch (e) {}
      }
    }
  });

  // Incremental update handler
  ipcMain.handle('policy:getIncrementalUpdate', async (event, newInventory, existingPolicyPath, outputPath) => {
    let tempJsonPath = null;
    try {
      // Validate paths
      if (!isPathAllowed(existingPolicyPath)) {
        throw new Error('Existing policy path is not in an allowed directory');
      }
      if (!isPathAllowed(outputPath)) {
        throw new Error('Output path is not in an allowed directory');
      }

      const scriptPath = path.join(scriptsDir, 'Get-IncrementalPolicyUpdate.ps1');
      tempJsonPath = path.join(require('os').tmpdir(), generateSecureTempFilename('incremental'));

      fs.writeFileSync(tempJsonPath, JSON.stringify(newInventory), 'utf8');

      // Use argument array instead of string interpolation
      const args = [
        '-NewInventoryPath', tempJsonPath,
        '-ExistingPolicyPath', existingPolicyPath,
        '-OutputPath', outputPath
      ];

      const result = await executePowerShellScript(scriptPath, args, {
        timeout: 300000 // 5 minutes
      });

      return {
        success: true,
        output: result.stdout,
        deltaPath: outputPath
      };
    } catch (error) {
      console.error('[IPC] Incremental update error:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    } finally {
      if (tempJsonPath) {
        try { fs.unlinkSync(tempJsonPath); } catch (e) {}
      }
    }
  });

  // Rule validation handler
  ipcMain.handle('policy:validateRules', async (event, policyPath) => {
    try {
      // SECURITY: Validate policy path
      if (policyPath && !isPathAllowed(policyPath)) {
        return { success: false, error: 'Policy path not allowed' };
      }

      const scriptPath = path.join(scriptsDir, 'Test-RuleHealth.ps1');
      const args = policyPath ? ['-PolicyPath', escapePowerShellString(policyPath)] : [];
      const result = await executePowerShellScript(scriptPath, args, {
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
        error: sanitizeErrorMessage(error)
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
        error: sanitizeErrorMessage(error)
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

  // Dialog handlers
  ipcMain.handle('dialog:showOpenDialog', async (event, options = {}) => {
    try {
      const { BrowserWindow } = require('electron');
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(window || undefined, {
        title: options.title || 'Select File',
        defaultPath: options.defaultPath,
        filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
        properties: options.properties || ['openFile'],
        ...options
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
        filePath: result.filePaths[0] || null
      };
    } catch (error) {
      console.error('[IPC] Open dialog error:', error);
      return {
        canceled: true,
        filePaths: [],
        filePath: null,
        error: sanitizeErrorMessage(error)
      };
    }
  });

  ipcMain.handle('dialog:showSaveDialog', async (event, options = {}) => {
    try {
      const { BrowserWindow } = require('electron');
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(window || undefined, {
        title: options.title || 'Save File',
        defaultPath: options.defaultPath,
        filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
        ...options
      });

      return {
        canceled: result.canceled,
        filePath: result.filePath || null
      };
    } catch (error) {
      console.error('[IPC] Save dialog error:', error);
      return {
        canceled: true,
        filePath: null,
        error: sanitizeErrorMessage(error)
      };
    }
  });

  ipcMain.handle('dialog:showOpenDirectoryDialog', async (event, options = {}) => {
    try {
      const { BrowserWindow } = require('electron');
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(window || undefined, {
        title: options.title || 'Select Directory',
        defaultPath: options.defaultPath,
        properties: ['openDirectory', 'createDirectory'],
        ...options
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
        filePath: result.filePaths[0] || null
      };
    } catch (error) {
      console.error('[IPC] Open directory dialog error:', error);
      return {
        canceled: true,
        filePaths: [],
        filePath: null,
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // File system handlers
  ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
    try {
      // Validate file path is in allowed directory
      if (!isPathAllowed(filePath)) {
        console.warn('[IPC] Blocked write to disallowed path:', filePath);
        return {
          success: false,
          error: 'File path is not in an allowed directory. Files can only be written to user documents, temp, or designated output directories.'
        };
      }

      // Validate file extension (only allow safe extensions)
      const allowedExtensions = ['.xml', '.json', '.csv', '.txt', '.log', '.ps1', '.html', '.md'];
      const ext = path.extname(filePath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        console.warn('[IPC] Blocked write with disallowed extension:', ext);
        return {
          success: false,
          error: `File extension '${ext}' is not allowed. Allowed: ${allowedExtensions.join(', ')}`
        };
      }

      // Limit file size to prevent denial of service
      const maxFileSize = 50 * 1024 * 1024; // 50 MB
      if (content && content.length > maxFileSize) {
        return {
          success: false,
          error: 'File content exceeds maximum allowed size (50 MB)'
        };
      }

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf8');
      return {
        success: true,
        filePath: filePath
      };
    } catch (error) {
      console.error('[IPC] Write file error:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    }
  });

  // Ensure directory exists
  ipcMain.handle('file:ensureDirectory', async (event, dirPath) => {
    try {
      if (!dirPath || typeof dirPath !== 'string') {
        return { success: false, error: 'Invalid directory path' };
      }

      // Validate directory path is in allowed location
      if (!isPathAllowed(dirPath)) {
        console.warn('[IPC] Blocked directory creation in disallowed path:', dirPath);
        return { success: false, error: 'Directory path is not in an allowed location' };
      }

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return { success: true, path: dirPath };
    } catch (error) {
      console.error('[IPC] Ensure directory error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // ============================================
  // ============================================
  // AD HANDLERS (Active Directory Operations)
  // ============================================
  //
  // LESSON LEARNED: All AD cmdlets (Get-ADUser, Get-ADGroup, Add-ADGroupMember, etc.)
  // require: Import-Module ActiveDirectory -ErrorAction Stop
  // Without explicit import, commands fail silently in Node.js child_process.
  //
  // LESSON LEARNED: Never return [] on error - return { error: "message" } instead
  // so the UI layer can display meaningful errors to the user.

  // Get all AD users (query from Active Directory)
  // Returns users with properly mapped fields matching TypeScript ADUser interface
  ipcMain.handle('ad:getUsers', async () => {
    try {
      // Query AD users with proper field mapping to match TypeScript interface
      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          # Explicitly import ActiveDirectory module
          Import-Module ActiveDirectory -ErrorAction Stop

          $users = Get-ADUser -Filter * -Properties DisplayName, Title, Department, EmailAddress, Enabled, MemberOf, DistinguishedName |
            Select-Object -First 200 @{N='id';E={$_.ObjectGUID.ToString()}},
              @{N='samAccountName';E={$_.SamAccountName}},
              @{N='displayName';E={if($_.DisplayName){$_.DisplayName}else{$_.SamAccountName}}},
              @{N='department';E={if($_.Department){$_.Department}else{'Unassigned'}}},
              @{N='ou';E={$_.DistinguishedName}},
              @{N='groups';E={@($_.MemberOf | ForEach-Object { ($_ -split ',')[0] -replace 'CN=' })}}

          if ($users) {
            @{ success = $true; data = @($users) } | ConvertTo-Json -Compress -Depth 4
          } else {
            @{ success = $true; data = @(); message = 'No users found in Active Directory' } | ConvertTo-Json -Compress
          }
        } catch {
          @{ success = $false; error = $_.Exception.Message; errorType = $_.Exception.GetType().Name } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 60000 });

      if (result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout);
          if (parsed.success === false) {
            console.error('[IPC] ad:getUsers AD error:', parsed.error);
            return { error: parsed.error, errorType: parsed.errorType };
          }
          // Ensure array format and validate structure
          const userArray = Array.isArray(parsed.data) ? parsed.data : [];
          return userArray.map(u => ({
            id: u.id || u.samAccountName || `user-${Math.random().toString(36).substr(2, 9)}`,
            samAccountName: u.samAccountName || 'unknown',
            displayName: u.displayName || u.samAccountName || 'Unknown User',
            department: u.department || '',
            ou: u.ou || '',
            groups: Array.isArray(u.groups) ? u.groups : (u.groups ? [u.groups] : [])
          }));
        } catch (e) {
          console.warn('[IPC] Could not parse AD users:', e);
        }
      }
      return { error: 'No response from PowerShell command' };
    } catch (error) {
      console.error('[IPC] Get AD users error:', error);
      return { error: sanitizeErrorMessage(error) };
    }
  });

  // Get user by ID
  // LESSON LEARNED: Must import ActiveDirectory module for Get-ADUser to work
  ipcMain.handle('ad:getUserById', async (event, userId) => {
    try {
      const safeUserId = escapePowerShellString(userId);
      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          Import-Module ActiveDirectory -ErrorAction Stop
          $user = Get-ADUser -Identity "${safeUserId}" -Properties DisplayName, Title, Department, EmailAddress, Enabled, MemberOf
          if ($user) {
            $result = @{
              id = $user.ObjectGUID.ToString()
              samAccountName = $user.SamAccountName
              displayName = if($user.DisplayName) { $user.DisplayName } else { $user.SamAccountName }
              department = if($user.Department) { $user.Department } else { '' }
              ou = $user.DistinguishedName
              groups = @($user.MemberOf | ForEach-Object { ($_ -split ',')[0] -replace 'CN=' })
            }
            @{ success = $true; data = $result } | ConvertTo-Json -Compress -Depth 3
          } else {
            @{ success = $false; error = 'User not found' } | ConvertTo-Json -Compress
          }
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 15000 });

      if (result.stdout) {
        const parsed = JSON.parse(result.stdout);
        if (parsed.success === false) {
          console.error('[IPC] ad:getUserById error:', parsed.error);
          return null;
        }
        return parsed.data;
      }
      return null;
    } catch (error) {
      console.error('[IPC] Get AD user by ID error:', error);
      return null;
    }
  });

  // Add user to AD group
  ipcMain.handle('ad:addToGroup', async (event, userId, groupName) => {
    try {
      const safeUserId = escapePowerShellString(userId);
      const safeGroupName = escapePowerShellString(groupName);

      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          Import-Module ActiveDirectory -ErrorAction Stop
          Add-ADGroupMember -Identity "${safeGroupName}" -Members "${safeUserId}" -ErrorAction Stop
          @{ success = $true } | ConvertTo-Json -Compress
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });
      return JSON.parse(result.stdout || '{"success":false}');
    } catch (error) {
      console.error('[IPC] Add to group error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // Remove user from AD group
  ipcMain.handle('ad:removeFromGroup', async (event, userId, groupName) => {
    try {
      const safeUserId = escapePowerShellString(userId);
      const safeGroupName = escapePowerShellString(groupName);

      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          Import-Module ActiveDirectory -ErrorAction Stop
          Remove-ADGroupMember -Identity "${safeGroupName}" -Members "${safeUserId}" -Confirm:$false -ErrorAction Stop
          @{ success = $true } | ConvertTo-Json -Compress
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });
      return JSON.parse(result.stdout || '{"success":false}');
    } catch (error) {
      console.error('[IPC] Remove from group error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // Get AD groups (AppLocker-related)
  ipcMain.handle('ad:getGroups', async () => {
    try {
      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          Import-Module ActiveDirectory -ErrorAction Stop
          $groups = Get-ADGroup -Filter "Name -like '*AppLocker*' -or Name -like '*Application*'" -Properties Description |
            Select-Object Name, Description, @{N='MemberCount';E={(Get-ADGroupMember -Identity $_.DistinguishedName -ErrorAction SilentlyContinue | Measure-Object).Count}} |
            ConvertTo-Json -Compress
          if ($groups) { $groups } else { '[]' }
        } catch {
          '[]'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout && result.stdout.trim() !== '[]') {
        try {
          const groups = JSON.parse(result.stdout);
          return Array.isArray(groups) ? groups : [groups];
        } catch (e) {
          console.warn('[IPC] Could not parse AD groups:', e);
        }
      }
      // Return default AppLocker groups if AD query fails
      return [
        'AppLocker-Admins',
        'AppLocker-Installers',
        'AppLocker-Developers',
        'AppLocker-Standard-Users',
        'AppLocker-Audit-Only'
      ];
    } catch (error) {
      console.error('[IPC] Get AD groups error:', error);
      return [];
    }
  });

  // Create AppLocker security groups in AD
  ipcMain.handle('ad:createAppLockerGroups', async (event, { ouPath }) => {
    try {
      // Validate ouPath if provided
      if (ouPath && typeof ouPath === 'string') {
        // Basic validation for OU path format
        if (!ouPath.match(/^(OU=|CN=|DC=)/i)) {
          return { success: false, error: 'Invalid OU path format' };
        }
      }

      const escapedOuPath = ouPath ? escapePowerShellString(ouPath) : '';

      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          # Import ActiveDirectory module
          Import-Module ActiveDirectory -ErrorAction Stop

          $groups = @(
            @{ Name = 'AppLocker-Admins'; Description = 'Full AppLocker bypass for IT administrators' },
            @{ Name = 'AppLocker-Installers'; Description = 'Users authorized to install software' },
            @{ Name = 'AppLocker-Developers'; Description = 'Developers with elevated script/app permissions' },
            @{ Name = 'AppLocker-Standard-Users'; Description = 'Standard users with default AppLocker restrictions' },
            @{ Name = 'AppLocker-Audit-Only'; Description = 'Users in audit-only mode (no enforcement)' }
          )

          $results = @()
          $targetOU = ${escapedOuPath ? `'${escapedOuPath}'` : '$null'}

          # If no OU specified, use Users container
          if (-not $targetOU) {
            $domain = Get-ADDomain
            $targetOU = "CN=Users," + $domain.DistinguishedName
          }

          foreach ($group in $groups) {
            $existing = Get-ADGroup -Filter "Name -eq '$($group.Name)'" -ErrorAction SilentlyContinue
            if ($existing) {
              $results += @{
                name = $group.Name
                status = 'exists'
                message = 'Group already exists'
              }
            } else {
              try {
                New-ADGroup -Name $group.Name -GroupScope Global -GroupCategory Security -Description $group.Description -Path $targetOU -ErrorAction Stop
                $results += @{
                  name = $group.Name
                  status = 'created'
                  message = 'Group created successfully'
                }
              } catch {
                $results += @{
                  name = $group.Name
                  status = 'error'
                  message = $_.Exception.Message
                }
              }
            }
          }

          @{ success = $true; results = $results; targetOU = $targetOU } | ConvertTo-Json -Compress -Depth 3
        } catch {
          @{ success = $false; error = $_.Exception.Message; errorType = $_.Exception.GetType().Name } | ConvertTo-Json -Compress
        }
      `;

      const result = await executePowerShellCommand(command, { timeout: 60000 });

      if (result.stdout) {
        try {
          return JSON.parse(result.stdout);
        } catch (e) {
          console.warn('[IPC] Could not parse create groups result:', e);
          return { success: false, error: 'Failed to parse result' };
        }
      }

      return { success: false, error: result.stderr || 'Unknown error' };
    } catch (error) {
      console.error('[IPC] Create AppLocker groups error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // Get WinRM GPO status
  ipcMain.handle('ad:getWinRMGPOStatus', async () => {
    try {
      const command = `
        try {
          $gpo = Get-GPO -Name "Enable-WinRM" -ErrorAction SilentlyContinue
          if ($gpo) {
            @{
              status = 'Enabled'
              gpoName = $gpo.DisplayName
              createdTime = $gpo.CreationTime.ToString('o')
              modifiedTime = $gpo.ModificationTime.ToString('o')
            } | ConvertTo-Json -Compress
          } else {
            @{ status = 'Disabled' } | ConvertTo-Json -Compress
          }
        } catch {
          @{ status = 'Unknown'; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout) {
        return JSON.parse(result.stdout);
      }
      return { status: 'Unknown' };
    } catch (error) {
      console.error('[IPC] Get WinRM GPO status error:', error);
      return { status: 'Unknown', error: sanitizeErrorMessage(error) };
    }
  });

  // Toggle WinRM GPO
  // LESSON LEARNED: New-GPO alone does NOTHING - GPO must be LINKED to domain/OU
  // After creating GPO, must call: New-GPLink -Name $gpoName -Target $domainDN -LinkEnabled Yes
  // Without linking, GPO exists but never applies to any machines.
  ipcMain.handle('ad:toggleWinRMGPO', async (event, enable) => {
    try {
      const scriptsDir = getScriptsDirectory();
      const scriptPath = path.join(scriptsDir, enable ? 'Enable-WinRMGPO.ps1' : 'Disable-WinRMGPO.ps1');

      // Check if script exists, otherwise use inline command
      if (fs.existsSync(scriptPath)) {
        const result = await executePowerShellScript(scriptPath, [], { timeout: 300000 });
        // Try to parse JSON from script output
        if (result.stdout) {
          try {
            return JSON.parse(result.stdout);
          } catch {
            return { success: true, output: result.stdout };
          }
        }
        return { success: true, output: result.stdout };
      } else {
        // Inline implementation with proper module import and GPO linking
        const command = enable ? `
          $ErrorActionPreference = 'Stop'
          try {
            # Import required modules
            Import-Module GroupPolicy -ErrorAction Stop
            Import-Module ActiveDirectory -ErrorAction Stop

            $gpoName = "Enable-WinRM"
            $gpo = Get-GPO -Name $gpoName -ErrorAction SilentlyContinue

            if (-not $gpo) {
              $gpo = New-GPO -Name $gpoName -Comment "Enables WinRM for remote management"
              Write-Host "Created new GPO: $gpoName"
            }

            # Configure WinRM settings via GPO
            Set-GPRegistryValue -Name $gpoName -Key "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WinRM\\Service" -ValueName "AllowAutoConfig" -Type DWord -Value 1
            Set-GPRegistryValue -Name $gpoName -Key "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WinRM\\Service" -ValueName "IPv4Filter" -Type String -Value "*"
            Set-GPRegistryValue -Name $gpoName -Key "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WinRM\\Service" -ValueName "IPv6Filter" -Type String -Value "*"

            # Enable the GPO
            $gpo.GpoStatus = 'AllSettingsEnabled'

            # Link GPO to domain root if not already linked
            $domain = Get-ADDomain
            $domainDN = $domain.DistinguishedName
            $existingLink = Get-GPInheritance -Target $domainDN | Select-Object -ExpandProperty GpoLinks | Where-Object { $_.DisplayName -eq $gpoName }

            if (-not $existingLink) {
              New-GPLink -Name $gpoName -Target $domainDN -LinkEnabled Yes
              Write-Host "Linked GPO to domain: $domainDN"
            }

            @{
              success = $true
              gpoName = $gpoName
              gpoId = $gpo.Id.ToString()
              status = 'Enabled'
              linkedTo = $domainDN
            } | ConvertTo-Json -Compress
          } catch {
            @{ success = $false; error = $_.Exception.Message; errorType = $_.Exception.GetType().Name } | ConvertTo-Json -Compress
          }
        ` : `
          $ErrorActionPreference = 'Stop'
          try {
            Import-Module GroupPolicy -ErrorAction Stop

            $gpoName = "Enable-WinRM"
            $gpo = Get-GPO -Name $gpoName -ErrorAction SilentlyContinue

            if ($gpo) {
              $gpo.GpoStatus = 'AllSettingsDisabled'
              @{ success = $true; status = 'Disabled'; gpoName = $gpoName } | ConvertTo-Json -Compress
            } else {
              @{ success = $true; status = 'NotFound'; message = 'GPO does not exist' } | ConvertTo-Json -Compress
            }
          } catch {
            @{ success = $false; error = $_.Exception.Message; errorType = $_.Exception.GetType().Name } | ConvertTo-Json -Compress
          }
        `;

        const result = await executePowerShellCommand(command, { timeout: 300000 });
        if (result.stdout) {
          try {
            return JSON.parse(result.stdout);
          } catch {
            return { success: false, error: 'Failed to parse PowerShell output' };
          }
        }
        return { success: false, error: 'No response from PowerShell command' };
      }
    } catch (error) {
      console.error('[IPC] Toggle WinRM GPO error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  /**
   * Get all OUs that contain computer objects.
   * Returns a list of unique OUs with computer counts for dropdown population.
   *
   * @channel ad:getOUsWithComputers
   * @returns {Object} Result with OUs array
   * @returns {boolean} returns.success - Whether the query succeeded
   * @returns {Array} returns.ous - Array of OU objects with path and computerCount
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * const result = await electron.ipc.invoke('ad:getOUsWithComputers');
   * // Returns: { success: true, ous: [{ path: "OU=Workstations,DC=corp,DC=local", name: "Workstations", computerCount: 50 }] }
   *
   * @since v1.2.10
  */
  ipcMain.handle('ad:getOUsWithComputers', async () => {
    try {
      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          Import-Module ActiveDirectory -ErrorAction Stop
          # Get all computers and extract unique OUs
          $computers = Get-ADComputer -Filter * -Properties DistinguishedName, OperatingSystem -ErrorAction Stop |
            Where-Object { $_.OperatingSystem -match 'Windows' }

          if (-not $computers) {
            @{ success = $true; ous = @() } | ConvertTo-Json -Compress -Depth 5
            return
          }

          # Extract OU from each computer's DN and count
          $ouCounts = @{}
          foreach ($computer in $computers) {
            # Extract the OU part from the DN (everything after the first comma)
            $dn = $computer.DistinguishedName
            $ouPath = ($dn -split ',', 2)[1]

            if ($ouPath) {
              if ($ouCounts.ContainsKey($ouPath)) {
                $ouCounts[$ouPath]++
              } else {
                $ouCounts[$ouPath] = 1
              }
            }
          }

          # Convert to array of objects with friendly names
          $ous = @()
          foreach ($ou in $ouCounts.Keys) {
            # Extract the most specific OU name for display
            $ouName = "Root"
            if ($ou -match 'OU=([^,]+)') {
              $ouName = $matches[1]
            } elseif ($ou -match 'CN=([^,]+)') {
              $ouName = $matches[1]
            }

            $ous += @{
              path = $ou
              name = $ouName
              computerCount = $ouCounts[$ou]
              # Determine type based on OU name
              type = if ($ouName -match 'Workstation|Desktop|WS|Client') { 'Workstation' }
                     elseif ($ouName -match 'Server|SRV|Member') { 'Server' }
                     elseif ($ouName -match 'Domain Controller') { 'DomainController' }
                     else { 'Unknown' }
            }
          }

          # Sort by computer count descending
          $ous = $ous | Sort-Object { -$_.computerCount }

          @{ success = $true; ous = $ous } | ConvertTo-Json -Compress -Depth 5
        } catch {
          @{ success = $false; error = $_.Exception.Message; ous = @() } | ConvertTo-Json -Compress -Depth 5
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 60000 });

      if (result.stdout) {
        const parsed = JSON.parse(result.stdout);
        return {
          success: parsed.success !== false,
          ous: Array.isArray(parsed.ous) ? parsed.ous : [],
          error: parsed.error
        };
      }
      return { success: true, ous: [] };
    } catch (error) {
      console.error('[IPC] Get OUs with computers error:', error);
      return { success: false, ous: [], error: sanitizeErrorMessage(error) };
    }
  });

  /**
   * Get all OUs that contain user objects.
   * Returns a list of unique OUs with user counts for dropdown population.
   *
   * @channel ad:getOUsWithUsers
   * @returns {Object} Result with OUs array
   * @returns {boolean} returns.success - Whether the query succeeded
   * @returns {Array} returns.ous - Array of OU objects with path and userCount
   * @returns {string} [returns.error] - Error message if failed
   *
   * @since v1.2.10
   */
  ipcMain.handle('ad:getOUsWithUsers', async () => {
    try {
      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          Import-Module ActiveDirectory -ErrorAction Stop
          # Get all users and extract unique OUs
          $users = Get-ADUser -Filter * -Properties DistinguishedName -ErrorAction SilentlyContinue

          if (-not $users) {
            @{ success = $true; ous = @() } | ConvertTo-Json -Compress -Depth 5
            return
          }

          # Extract OU from each user's DN and count
          $ouCounts = @{}
          foreach ($user in $users) {
            # Extract the OU part from the DN (everything after the first comma)
            $dn = $user.DistinguishedName
            $ouPath = ($dn -split ',', 2)[1]

            if ($ouPath) {
              if ($ouCounts.ContainsKey($ouPath)) {
                $ouCounts[$ouPath]++
              } else {
                $ouCounts[$ouPath] = 1
              }
            }
          }

          # Convert to array of objects with friendly names
          $ous = @()
          foreach ($ou in $ouCounts.Keys) {
            # Extract the most specific OU name for display
            $ouName = "Root"
            if ($ou -match 'OU=([^,]+)') {
              $ouName = $matches[1]
            } elseif ($ou -match 'CN=([^,]+)') {
              $ouName = $matches[1]
            }

            $ous += @{
              path = $ouName
              name = $ouName
              userCount = $ouCounts[$ou]
            }
          }

          # Sort by user count descending
          $ous = $ous | Sort-Object { -$_.userCount }

          @{ success = $true; ous = $ous } | ConvertTo-Json -Compress -Depth 5
        } catch {
          @{ success = $false; error = $_.Exception.Message; ous = @() } | ConvertTo-Json -Compress -Depth 5
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 60000 });

      if (result.stdout) {
        const parsed = JSON.parse(result.stdout);
        return {
          success: parsed.success !== false,
          ous: Array.isArray(parsed.ous) ? parsed.ous : [],
          error: parsed.error
        };
      }
      return { success: true, ous: [] };
    } catch (error) {
      console.error('[IPC] Get OUs with users error:', error);
      return { success: false, ous: [], error: sanitizeErrorMessage(error) };
    }
  });

  // ============================================
  // MACHINE HANDLERS (Remote Scanning)
  // ============================================
  //
  // LESSON LEARNED: Get-ADComputer requires Import-Module ActiveDirectory
  // Without explicit import, command fails silently and returns nothing.
  // Always use structured error responses so UI can show meaningful errors.

  // Get all machines from AD
  ipcMain.handle('machine:getAll', async () => {
    try {
      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          # Explicitly import ActiveDirectory module
          Import-Module ActiveDirectory -ErrorAction Stop

          $computers = Get-ADComputer -Filter * -Properties OperatingSystem, LastLogonDate, DistinguishedName, Description |
            Where-Object { $_.OperatingSystem -match 'Windows' } |
            Select-Object -First 200 Name, OperatingSystem, LastLogonDate, DistinguishedName, Description,
              @{N='OU';E={($_.DistinguishedName -split ',', 2)[1]}} |
            ForEach-Object {
              @{
                id = [guid]::NewGuid().ToString()
                hostname = $_.Name
                ou = $_.OU
                os = $_.OperatingSystem
                lastScan = if($_.LastLogonDate) { $_.LastLogonDate.ToString('yyyy-MM-dd') } else { 'Never' }
                status = if($_.LastLogonDate -and $_.LastLogonDate -gt (Get-Date).AddDays(-30)) { 'Online' } else { 'Offline' }
                riskLevel = 'Low'
                appCount = 0
              }
            }

          if ($computers) {
            @{ success = $true; data = @($computers) } | ConvertTo-Json -Compress -Depth 4
          } else {
            @{ success = $true; data = @(); message = 'No computers found in Active Directory' } | ConvertTo-Json -Compress
          }
        } catch {
          @{ success = $false; error = $_.Exception.Message; errorType = $_.Exception.GetType().Name } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 60000 });

      if (result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout);
          if (parsed.success === false) {
            console.error('[IPC] machine:getAll AD error:', parsed.error);
            // Return error object so UI can display message
            return { error: parsed.error, errorType: parsed.errorType };
          }
          return Array.isArray(parsed.data) ? parsed.data : [];
        } catch (e) {
          console.warn('[IPC] Could not parse machines:', e);
        }
      }
      return { error: 'No response from PowerShell command' };
    } catch (error) {
      console.error('[IPC] Get all machines error:', error);
      return { error: sanitizeErrorMessage(error) };
    }
  });

  // Get machine by ID
  ipcMain.handle('machine:getById', async (event, id) => {
    try {
      // For now, return null - would need to track IDs in a database
      console.log('[IPC] Get machine by ID:', id);
      return null;
    } catch (error) {
      console.error('[IPC] Get machine by ID error:', error);
      return null;
    }
  });

  // Start batch scan (uses existing batch scan handler from earlier in file)
  ipcMain.handle('machine:startScan', async (event, options = {}) => {
    try {
      const scriptsDir = getScriptsDirectory();
      const scanScriptPath = path.join(scriptsDir, 'Start-BatchScan.ps1');

      const args = [];
      const credentials = options.credentials && typeof options.credentials === 'object'
        ? options.credentials
        : {};
      const useCurrentUser = credentials.useCurrentUser !== undefined
        ? Boolean(credentials.useCurrentUser)
        : true;
      const scanEnv = { ...process.env };

      args.push(`-UseCurrentUser:${useCurrentUser ? '$true' : '$false'}`);

      if (credentials.username && typeof credentials.username === 'string') {
        args.push('-Username', escapePowerShellString(credentials.username));
      }

      if (credentials.domain && typeof credentials.domain === 'string') {
        args.push('-Domain', escapePowerShellString(credentials.domain));
      }

      if (credentials.password && typeof credentials.password === 'string') {
        const passwordEnvVar = `GA_APPLOCKER_SCAN_PASSWORD_${crypto.randomBytes(8).toString('hex')}`;
        scanEnv[passwordEnvVar] = credentials.password;
        args.push('-PasswordEnvVar', passwordEnvVar);
      }
      if (options.targetOUs && Array.isArray(options.targetOUs) && options.targetOUs.length > 0) {
        // SECURITY FIX: Escape each OU path to prevent command injection
        const escapedOUs = options.targetOUs
          .filter(ou => typeof ou === 'string' && ou.length > 0 && ou.length <= 1024)
          .map(ou => escapePowerShellString(ou));
        if (escapedOUs.length > 0) {
          args.push('-TargetOUs', escapedOUs.join(','));
        }
      }
      const computerNames = (options.computerNames && Array.isArray(options.computerNames) && options.computerNames.length > 0)
        ? options.computerNames
        : (options.targetMachines && Array.isArray(options.targetMachines) && options.targetMachines.length > 0)
          ? options.targetMachines
          : [];
      if (computerNames.length > 0) {
        // SECURITY FIX: Escape each computer name to prevent command injection
        const escapedNames = computerNames
          .filter(cn => typeof cn === 'string' && cn.length > 0 && cn.length <= 255)
          .map(cn => escapePowerShellString(cn));
        if (escapedNames.length > 0) {
          args.push('-ComputerNames', escapedNames.join(','));
        }
      }

      const result = await executePowerShellScript(scanScriptPath, args, {
        timeout: options.timeout || 600000,
        env: scanEnv
      });

      return { success: true, output: result.stdout };
    } catch (error) {
      console.error('[IPC] Start scan error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // ============================================
  // LOCAL SCAN HANDLER
  // ============================================
  /**
   * Scans the local machine for installed applications and executables.
   *
   * @channel scan:local
   * @param {Object} options - Scan options (currently unused, reserved for future use)
   * @param {boolean} options.credentials.useCurrentUser - Whether to use current user context
   * @returns {Object} Scan results
   * @returns {boolean} returns.success - Whether the scan completed successfully
   * @returns {number} returns.appCount - Number of unique installed applications found
   * @returns {number} returns.exeCount - Number of executable files found in system paths
   * @returns {string} returns.computerName - Name of the scanned computer
   * @returns {string} returns.scanTime - ISO timestamp of when scan completed
   * @returns {string} [returns.error] - Error message if scan failed
   *
   * @description
   * This handler performs a local inventory scan by:
   * 1. Querying the Windows Registry for installed 64-bit applications
   * 2. Querying the Windows Registry for installed 32-bit applications (WOW6432Node)
   * 3. Counting executable files in Program Files, Program Files (x86), and Windows directories
   *
   * The scan runs with a 2-minute timeout to allow for thorough file system traversal.
   * Results are returned as JSON for display in the ScanModule UI.
   *
   * @example
   * // Invoke from renderer process:
   * const result = await electron.ipc.invoke('scan:local', { credentials: { useCurrentUser: true } });
   * if (result.success) {
   *   console.log(`Found ${result.appCount} apps and ${result.exeCount} executables`);
   * }
   *
   * @since v1.2.10
   * @see ScanModule.tsx - handleLocalScan()
   */
  ipcMain.handle('scan:local', async (event, options = {}) => {
    try {
      const command = `
        try {
          # Get installed applications from registry
          $apps = @()

          # 64-bit applications
          $apps += Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName } |
            Select-Object DisplayName, Publisher, DisplayVersion, InstallLocation

          # 32-bit applications on 64-bit Windows
          $apps += Get-ItemProperty "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName } |
            Select-Object DisplayName, Publisher, DisplayVersion, InstallLocation

          # Get executables from common paths
          $exePaths = @(
            "$env:ProgramFiles",
            "\${env:ProgramFiles(x86)}",
            "$env:SystemRoot"
          )

          $exeCount = 0
          foreach ($exePath in $exePaths) {
            if (Test-Path $exePath) {
              $exeCount += (Get-ChildItem -Path $exePath -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
            }
          }

          @{
            success = $true
            appCount = ($apps | Where-Object { $_.DisplayName } | Select-Object -Unique DisplayName | Measure-Object).Count
            exeCount = $exeCount
            computerName = $env:COMPUTERNAME
            scanTime = (Get-Date).ToString('o')
          } | ConvertTo-Json -Compress
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;

      const result = await executePowerShellCommand(command, { timeout: 300000 }); // 5 minutes for full scan

      if (result.stdout) {
        return JSON.parse(result.stdout);
      }
      return { success: false, error: 'No output from scan' };
    } catch (error) {
      console.error('[IPC] Local scan error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // ============================================
  // EVENT HANDLERS (AppLocker Audit Logs)
  // ============================================

  /**
   * Get all AppLocker events from Windows Event Viewer
   *
   * Retrieves events from "Microsoft-Windows-AppLocker/EXE and DLL" log.
   * Parses event messages to extract file path and publisher information.
   *
   * Event IDs:
   * - 8001: Policy applied successfully
   * - 8002: Application allowed
   * - 8003: Would have been blocked (audit mode)
   * - 8004: Application blocked (enforce mode)
   *
   * @returns {Array<AppEvent>} Array of parsed AppLocker events with:
   *   - id: Unique identifier
   *   - eventId: Windows event ID (8001-8004)
   *   - timestamp: ISO format timestamp
   *   - machine: Computer name
   *   - path: Executable file path (parsed from message)
   *   - publisher: Software publisher (parsed from message)
   *   - action: 'Allowed', 'Audit', or 'Blocked'
   */
  ipcMain.handle('event:getAll', async () => {
    try {
      const command = `
        $ErrorActionPreference = 'Stop'
        try {
          # Check if AppLocker log exists
          # LESSON LEARNED: Use single quotes for log names with spaces - double quotes get stripped by -Command
          $logName = 'Microsoft-Windows-AppLocker/EXE and DLL'
          $logExists = Get-WinEvent -ListLog $logName -ErrorAction SilentlyContinue

          if (-not $logExists) {
            @{
              success = $false
              error = 'AppLocker event log not found. AppLocker may not be configured on this system.'
              errorType = 'LogNotFound'
            } | ConvertTo-Json -Compress
            return
          }

          # Fetch last 100 AppLocker events from EXE and DLL log
          $events = Get-WinEvent -LogName $logName -MaxEvents 100 -ErrorAction Stop |
            ForEach-Object {
              $msg = $_.Message

              # Parse file path from event message
              $path = ''
              $publisher = ''
              $action = ''

              # Try to extract path - simpler regex to avoid escaping issues
              # Look for .exe paths
              if ($msg -match '([A-Za-z]:[^*?"<>|]+\.exe)') {
                $path = $matches[1]
              }

              # Try to extract publisher information
              if ($msg -match 'Publisher:\s*(.+)') {
                $publisher = ($matches[1] -split "`r")[0].Trim()
              } elseif ($msg -match 'signed by\s+(.+)') {
                $publisher = ($matches[1] -split "`r")[0].Trim()
              }

              # Map event ID to action type
              $action = if($_.Id -eq 8004) { 'Blocked' } elseif($_.Id -eq 8003) { 'Audit' } else { 'Allowed' }

              # Return structured event object
              @{
                id = [guid]::NewGuid().ToString()
                eventId = $_.Id
                timestamp = $_.TimeCreated.ToString('o')
                machine = $env:COMPUTERNAME
                path = $path
                publisher = $publisher
                action = $action
              }
            }

          if ($events -and $events.Count -gt 0) {
            @{ success = $true; data = @($events) } | ConvertTo-Json -Compress -Depth 4
          } else {
            @{
              success = $true
              data = @()
              message = 'No AppLocker events found. This may mean AppLocker is not configured or no applications have been blocked/audited yet.'
            } | ConvertTo-Json -Compress
          }
        } catch [System.Exception] {
          if ($_.Exception.Message -match 'No events were found') {
            @{
              success = $true
              data = @()
              message = 'No AppLocker events found. Configure AppLocker policies to start generating events.'
            } | ConvertTo-Json -Compress
          } else {
            @{ success = $false; error = $_.Exception.Message; errorType = $_.Exception.GetType().Name } | ConvertTo-Json -Compress
          }
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout);
          if (parsed.success === false) {
            console.warn('[IPC] event:getAll:', parsed.error);
            return { error: parsed.error, errorType: parsed.errorType };
          }
          if (parsed.message) {
            console.log('[IPC] event:getAll:', parsed.message);
          }
          return Array.isArray(parsed.data) ? parsed.data : [];
        } catch (e) {
          console.warn('[IPC] Could not parse events:', e);
        }
      }
      return { error: 'No response from PowerShell command' };
    } catch (error) {
      console.error('[IPC] Get events error:', error);
      return { error: sanitizeErrorMessage(error) };
    }
  });

  // Get event statistics
  ipcMain.handle('event:getStats', async () => {
    try {
      const command = `
        try {
          $logName = 'Microsoft-Windows-AppLocker/EXE and DLL'
          $events = Get-WinEvent -LogName $logName -MaxEvents 1000 -ErrorAction SilentlyContinue
          $blocked = ($events | Where-Object { $_.Id -eq 8004 }).Count
          $audit = ($events | Where-Object { $_.Id -eq 8003 }).Count
          $allowed = ($events | Where-Object { $_.Id -eq 8002 }).Count

          $uniquePaths = 0
          try {
            $pathSet = New-Object 'System.Collections.Generic.HashSet[string]'
            foreach ($event in $events) {
              if ($event.Message) {
                $match = [regex]::Match($event.Message, '[A-Z]:\\[^\\r\\n"]+')
                if ($match.Success) {
                  $null = $pathSet.Add($match.Value)
                }
              }
            }
            $uniquePaths = $pathSet.Count
          } catch {
            $uniquePaths = 0
          }

          @{
            totalBlocked = $blocked
            totalAudit = $audit
            totalAllowed = $allowed
            uniquePaths = $uniquePaths
          } | ConvertTo-Json -Compress
        } catch {
          @{ totalBlocked = 0; totalAudit = 0; totalAllowed = 0; uniquePaths = 0 } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout) {
        return JSON.parse(result.stdout);
      }
      return { totalBlocked: 0, totalAudit: 0, totalAllowed: 0, uniquePaths: 0 };
    } catch (error) {
      console.error('[IPC] Get event stats error:', error);
      return { totalBlocked: 0, totalAudit: 0, totalAllowed: 0, uniquePaths: 0 };
    }
  });

  // Export events to CSV
  ipcMain.handle('event:exportCSV', async (event, outputPath) => {
    try {
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      const safeOutputPath = escapePowerShellString(outputPath);
      const command = `
        try {
          $logName = 'Microsoft-Windows-AppLocker/EXE and DLL'
          Get-WinEvent -LogName $logName -MaxEvents 5000 -ErrorAction SilentlyContinue |
            Select-Object Id, TimeCreated, Message |
            Export-Csv -Path "${safeOutputPath}" -NoTypeInformation
          @{ success = $true; path = "${safeOutputPath}" } | ConvertTo-Json -Compress
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 60000 });
      return JSON.parse(result.stdout || '{"success":false}');
    } catch (error) {
      console.error('[IPC] Export events error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // ============================================
  // EVENT BACKUP HANDLER
  // ============================================
  /**
   * Backup AppLocker events to an EVTX file.
   *
   * @channel events:backup
   * @param {Object} options - Backup options
   * @param {string} options.systemName - Name of the system (for remote) or local
   * @param {string} options.outputPath - Full path for the output EVTX file
   * @param {boolean} options.createFolderIfMissing - Create parent folder if it doesn't exist
   * @returns {Object} Result with success status
   *
   * @since v1.2.10
   * @see EventsModule.tsx - handleBackupEvents()
   */
  ipcMain.handle('events:backup', async (event, options = {}) => {
    try {
      const { systemName, outputPath, createFolderIfMissing } = options;

      if (!outputPath) {
        return { success: false, error: 'Output path is required' };
      }

      // Ensure the output path is allowed
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      const normalizedOutputPath = path.resolve(outputPath).toLowerCase();
      const normalizedDefaultRoot = path.resolve(DEFAULT_EVENTS_BACKUP_ROOT).toLowerCase();
      if (
        normalizedOutputPath !== normalizedDefaultRoot &&
        !normalizedOutputPath.startsWith(`${normalizedDefaultRoot}${path.sep}`)
      ) {
        return {
          success: false,
          error: `Output path must be under ${DEFAULT_EVENTS_BACKUP_ROOT}`
        };
      }

      const safeOutputPath = escapePowerShellString(outputPath);
      const targetSystems = Array.isArray(options.systems)
        ? options.systems
        : (typeof systemName === 'string' && systemName.length > 0 ? systemName.split(',') : []);
      const sanitizedSystems = targetSystems
        .filter(system => typeof system === 'string' && system.length > 0 && system.length <= 255)
        .map(system => escapePowerShellString(system.trim()));
      const systemsLiteral = sanitizedSystems.length > 0
        ? `@("${sanitizedSystems.join('","')}")`
        : '@()';

      // Export AppLocker events using PowerShell Get-WinEvent (no UAC prompts)
      // wevtutil requires elevation, so we use Get-WinEvent export instead
      const command = `
        try {
          $targetSystems = ${systemsLiteral}
          if (-not $targetSystems -or $targetSystems.Count -eq 0) {
            $targetSystems = @($env:COMPUTERNAME)
          }

          # Create output directory if needed
          $outputDir = Split-Path -Parent "${safeOutputPath}"
          if (${createFolderIfMissing ? '$true' : '$false'} -and -not (Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
          }

          # Export AppLocker events to EVTX format using Get-WinEvent and export
          $logNames = @(
            'Microsoft-Windows-AppLocker/EXE and DLL',
            'Microsoft-Windows-AppLocker/MSI and Script',
            'Microsoft-Windows-AppLocker/Packaged app-Deployment',
            'Microsoft-Windows-AppLocker/Packaged app-Execution'
          )

          $allEvents = @()
          foreach ($system in $targetSystems) {
            foreach ($logName in $logNames) {
              try {
                $events = Get-WinEvent -ComputerName $system -LogName $logName -MaxEvents 5000 -ErrorAction SilentlyContinue
                if ($events) {
                  $allEvents += $events
                }
              } catch {
                # Log might be empty or not accessible
              }
            }
          }

          if ($allEvents.Count -gt 0) {
            # Export events to XML format (more portable than EVTX without elevation)
            $xmlPath = "${safeOutputPath}".Replace('.evtx', '.xml')
            $allEvents | Select-Object TimeCreated, Id, LevelDisplayName, Message, MachineName, ProviderName |
              Export-Clixml -Path $xmlPath -Force

            # Also try wevtutil silently (local machine only - remote export requires elevation/credentials)
            if ($targetSystems.Count -eq 1 -and $targetSystems[0] -eq $env:COMPUTERNAME) {
              $primaryLog = 'Microsoft-Windows-AppLocker/EXE and DLL'
              Start-Process -FilePath "wevtutil.exe" -ArgumentList "epl \`"$primaryLog\`" \`"${safeOutputPath}\`" /ow:true" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue 2>$null
            }

            $result = @{
              success = $true
              outputPath = if (Test-Path "${safeOutputPath}") { "${safeOutputPath}" } else { $xmlPath }
              systems = $targetSystems
              eventCount = $allEvents.Count
              timestamp = (Get-Date).ToString('o')
            }
            $result | ConvertTo-Json -Compress
          } else {
            @{
              success = $false
              error = "No AppLocker events found to backup"
            } | ConvertTo-Json -Compress
          }
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;

      // Run completely hidden
      const result = await executePowerShellCommand(command, { timeout: 120000, hidden: true });

      if (result.stdout) {
        return JSON.parse(result.stdout);
      }
      return { success: false, error: 'No output from backup command' };
    } catch (error) {
      console.error('[IPC] Event backup error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // ============================================
  // COMPLIANCE HANDLERS
  // ============================================

  // Get evidence status
  ipcMain.handle('compliance:getEvidenceStatus', async () => {
    try {
      // Check both C:\AppLocker and local paths for evidence
      const primaryDir = 'C:\\AppLocker\\compliance';
      const fallbackDir = path.join(process.cwd(), 'compliance');
      const evidenceDir = fs.existsSync(primaryDir) ? primaryDir : fallbackDir;

      const hasPolicyDefs = fs.existsSync(path.join(evidenceDir, 'policies'));
      const hasAuditLogs = fs.existsSync(path.join(evidenceDir, 'audit-logs'));
      const hasSnapshots = fs.existsSync(path.join(evidenceDir, 'snapshots'));

      return {
        policyDefinitions: hasPolicyDefs ? 'COMPLETE' : 'MISSING',
        auditLogs: hasAuditLogs ? 'SYNCED' : 'MISSING',
        systemSnapshots: hasSnapshots ? 'COMPLETE' : 'STALE',
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[IPC] Get evidence status error:', error);
      return {
        policyDefinitions: 'UNKNOWN',
        auditLogs: 'UNKNOWN',
        systemSnapshots: 'UNKNOWN',
        lastUpdate: null,
      };
    }
  });

  /**
   * Generate and export compliance evidence package
   *
   * Collects:
   * - AppLocker policies (effective and local)
   * - Audit event logs (last 30 days)
   * - System configuration snapshots
   * - Compliance report with checks
   *
   * @param {Object} options - Configuration options
   * @param {string} options.outputDirectory - Where to save evidence (default: ./compliance)
   * @returns {Object} Result with outputPath, details (policies, events, machines counts)
   */
  ipcMain.handle('compliance:generateEvidence', async (event, options = {}) => {
    try {
      console.log('[IPC] Starting compliance evidence collection...');
      const scriptsDir = getScriptsDirectory();
      const scriptPath = path.join(scriptsDir, 'Export-ComplianceEvidence.ps1');

      // Default to C:\AppLocker\compliance
      const outputDir = options.outputDirectory || 'C:\\AppLocker\\compliance';
      // Ensure output directory exists before running the script
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const args = ['-OutputDirectory', escapePowerShellString(outputDir)];

      let evidencePath = outputDir;
      let policiesIncluded = 0;
      let eventsIncluded = 0;
      let machinesScanned = 1; // At minimum, local machine

      if (fs.existsSync(scriptPath)) {
        console.log('[IPC] Running Export-ComplianceEvidence.ps1...');
        const result = await executePowerShellScript(scriptPath, args, { timeout: 300000 });

        // Try to parse the JSON output from the script
        try {
          const stdout = result.stdout || '';
          // Look for JSON in the output (script outputs JSON at the end)
          const jsonMatch = stdout.match(/\{[^{}]*"success"[^{}]*\}/);
          if (jsonMatch) {
            const scriptResult = JSON.parse(jsonMatch[0]);
            if (scriptResult.outputPath) {
              evidencePath = scriptResult.outputPath;
            }
          }
        } catch (parseErr) {
          console.warn('[IPC] Could not parse script JSON output:', parseErr.message);
        }

        // Count collected evidence from the newest Evidence_* folder
        try {
          const evidenceDirs = fs.readdirSync(outputDir)
            .filter(d => d.startsWith('Evidence_'))
            .map(d => path.join(outputDir, d))
            .filter(p => fs.statSync(p).isDirectory())
            .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

          if (evidenceDirs.length > 0) {
            evidencePath = evidenceDirs[0];

            // Count policies
            const policiesDir = path.join(evidencePath, 'policies');
            if (fs.existsSync(policiesDir)) {
              policiesIncluded = fs.readdirSync(policiesDir)
                .filter(f => f.endsWith('.xml') || f.endsWith('.json')).length;
            }

            // Count events from CSV or stats
            const auditLogsDir = path.join(evidencePath, 'audit-logs');
            if (fs.existsSync(auditLogsDir)) {
              const statsFile = path.join(auditLogsDir, 'EventStatistics.json');
              if (fs.existsSync(statsFile)) {
                try {
                  const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
                  eventsIncluded = stats.TotalEvents || 0;
                } catch (e) {
                  // Fall back to counting CSV lines
                  const csvFile = path.join(auditLogsDir, 'AppLockerEvents.csv');
                  if (fs.existsSync(csvFile)) {
                    const lines = fs.readFileSync(csvFile, 'utf8').split('\n');
                    eventsIncluded = Math.max(0, lines.length - 1); // Minus header
                  }
                }
              }
            }

            // Check for machine info in snapshots
            const snapshotsDir = path.join(evidencePath, 'snapshots');
            if (fs.existsSync(snapshotsDir)) {
              machinesScanned = fs.readdirSync(snapshotsDir)
                .filter(f => f.endsWith('.json')).length || 1;
            }
          }
        } catch (countErr) {
          console.warn('[IPC] Error counting evidence files:', countErr.message);
        }

        console.log(`[IPC] Evidence collected: ${policiesIncluded} policies, ${eventsIncluded} events`);

        return {
          success: true,
          outputPath: evidencePath,
          policiesIncluded,
          eventsIncluded,
          machinesScanned
        };
      }

      // Fallback: Create evidence directory structure manually
      console.log('[IPC] PowerShell script not found, creating structure manually...');
      const dirs = ['policies', 'audit-logs', 'snapshots', 'reports'];
      for (const dir of dirs) {
        const dirPath = path.join(outputDir, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }

      return {
        success: true,
        outputPath: outputDir,
        policiesIncluded: 0,
        eventsIncluded: 0,
        machinesScanned: 0,
        note: 'Manual structure created - run on Windows with AppLocker for full collection'
      };
    } catch (error) {
      console.error('[IPC] Generate evidence error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // Get historical reports
  ipcMain.handle('compliance:getHistoricalReports', async () => {
    try {
      const reportsDir = path.join(process.cwd(), 'compliance', 'reports');

      if (!fs.existsSync(reportsDir)) {
        return [];
      }

      const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json') || f.endsWith('.html'));
      return files.map(f => ({
        name: f,
        path: path.join(reportsDir, f),
        date: fs.statSync(path.join(reportsDir, f)).mtime.toISOString()
      }));
    } catch (error) {
      console.error('[IPC] Get historical reports error:', error);
      return [];
    }
  });

  // Validate evidence
  ipcMain.handle('compliance:validateEvidence', async () => {
    try {
      const evidenceDir = path.join(process.cwd(), 'compliance');
      const missingItems = [];
      const warnings = [];

      // Check required directories
      const requiredDirs = ['policies', 'audit-logs'];
      for (const dir of requiredDirs) {
        if (!fs.existsSync(path.join(evidenceDir, dir))) {
          missingItems.push(`Missing directory: ${dir}`);
        }
      }

      // Check for stale data
      const snapshotsDir = path.join(evidenceDir, 'snapshots');
      if (fs.existsSync(snapshotsDir)) {
        const files = fs.readdirSync(snapshotsDir);
        if (files.length === 0) {
          warnings.push('No system snapshots found');
        }
      }

      return {
        isValid: missingItems.length === 0,
        missingItems,
        warnings,
      };
    } catch (error) {
      console.error('[IPC] Validate evidence error:', error);
      return { isValid: false, missingItems: ['Validation failed'], warnings: [sanitizeErrorMessage(error)] };
    }
  });

  // ============================================
  // POLICY HANDLERS (Additional)
  // ============================================

  // Create publisher rule
  ipcMain.handle('policy:createPublisherRule', async (event, options, outputPath) => {
    try {
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      const publisher = escapePowerShellString(options.publisher);
      const action = options.action || 'Allow';
      const targetGroup = escapePowerShellString(options.targetGroup || 'Everyone');

      const command = `
        try {
          $rule = @"
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <FilePublisherRule Id="$([guid]::NewGuid())" Name="${publisher}" Description="Auto-generated publisher rule" UserOrGroupSid="S-1-1-0" Action="${action}">
      <Conditions>
        <FilePublisherCondition PublisherName="${publisher}" ProductName="*" BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*" />
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>
  </RuleCollection>
</AppLockerPolicy>
"@
          $rule | Out-File -FilePath "${escapePowerShellString(outputPath)}" -Encoding UTF8
          @{ success = $true; outputPath = "${escapePowerShellString(outputPath)}" } | ConvertTo-Json -Compress
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;

      const result = await executePowerShellCommand(command, { timeout: 30000 });
      return JSON.parse(result.stdout || '{"success":false}');
    } catch (error) {
      console.error('[IPC] Create publisher rule error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // Batch create publisher rules
  ipcMain.handle('policy:batchCreatePublisherRules', async (event, publishers, outputPath, options = {}) => {
    try {
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      const action = options.action || 'Allow';
      const rules = publishers.map(pub => {
        const safePub = escapePowerShellString(pub);
        return `    <FilePublisherRule Id="${crypto.randomUUID()}" Name="${safePub}" Action="${action}" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePublisherCondition PublisherName="${safePub}" ProductName="*" BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*" />
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>`;
      }).join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
${rules}
  </RuleCollection>
</AppLockerPolicy>`;

      fs.writeFileSync(outputPath, xml, 'utf8');
      return { success: true, outputPath, ruleCount: publishers.length };
    } catch (error) {
      console.error('[IPC] Batch create publisher rules error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  /**
   * Save a single AppLocker rule to XML file
   *
   * Generates a complete AppLocker policy XML file containing one rule.
   * Supports three rule types:
   * - Publisher: Based on software publisher certificate (recommended for signed software)
   * - Path: Based on file system path (use with caution, easily bypassed)
   * - Hash: Based on file hash (secure but breaks on updates)
   *
   * @param {Object} options - Rule configuration
   * @param {Object} options.subject - The item to create rule for (InventoryItem or TrustedPublisher)
   * @param {string} options.action - 'Allow' or 'Deny'
   * @param {string} options.ruleType - 'Publisher', 'Path', or 'Hash'
   * @param {string} options.targetGroup - Security group the rule applies to
   * @param {string} options.collectionType - 'Exe', 'Script', 'Msi', or 'Dll'
   * @param {string} outputPath - Full path where XML file will be saved
   * @returns {Object} { success: boolean, outputPath?: string, error?: string }
   */
  ipcMain.handle('policy:saveRule', async (event, options, outputPath) => {
    try {
      // Security: Validate output path is in allowed directory
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      // Extract and sanitize rule parameters
      const subject = options.subject;
      const action = options.action || 'Allow';
      const ruleType = options.ruleType || 'Publisher';
      const targetGroup = escapePowerShellString(options.targetGroup || 'Everyone');
      const collectionType = options.collectionType || 'Exe';

      // Generate unique rule ID and sanitize inputs
      const ruleId = crypto.randomUUID();
      const ruleName = escapePowerShellString(subject?.name || 'Generated-Rule');
      const publisher = escapePowerShellString(subject?.publisher || subject?.publisherName || 'Unknown');
      const filePath = escapePowerShellString(subject?.path || '*');

      let ruleXml = '';

      // Generate rule XML based on rule type
      if (ruleType === 'Publisher') {
        // Publisher rules: Most flexible, survives software updates
        // Uses wildcard (*) for ProductName and BinaryName for broad coverage
        ruleXml = `    <FilePublisherRule Id="${ruleId}" Name="${ruleName}" Action="${action}" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePublisherCondition PublisherName="${publisher}" ProductName="*" BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*" />
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>`;
      } else if (ruleType === 'Path') {
        // Path rules: Simple but less secure (user can copy file elsewhere)
        ruleXml = `    <FilePathRule Id="${ruleId}" Name="${ruleName}" Action="${action}" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="${filePath}" />
      </Conditions>
    </FilePathRule>`;
      } else if (ruleType === 'Hash') {
        // Hash rules: Most secure but breaks on any file change
        // NOTE: Placeholder hash - real implementation would compute actual file hash
        ruleXml = `    <FileHashRule Id="${ruleId}" Name="${ruleName}" Action="${action}" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FileHashCondition>
          <FileHash Type="SHA256" Data="0000000000000000000000000000000000000000000000000000000000000000" SourceFileName="${ruleName}" />
        </FileHashCondition>
      </Conditions>
    </FileHashRule>`;
      }

      // Wrap rule in complete AppLocker policy XML structure
      // EnforcementMode="AuditOnly" for safe testing before enforcement
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AppLockerPolicy Version="1">
  <RuleCollection Type="${collectionType}" EnforcementMode="AuditOnly">
${ruleXml}
  </RuleCollection>
</AppLockerPolicy>`;

      // Create output directory if it doesn't exist
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write XML to file
      fs.writeFileSync(outputPath, xml, 'utf8');
      return { success: true, outputPath };
    } catch (error) {
      console.error('[IPC] Save rule error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // ============================================
  // POLICY INVENTORY HANDLERS
  // ============================================

  // Get software inventory from local machine or network
  ipcMain.handle('policy:getInventory', async () => {
    try {
      const command = `
        try {
          # Get installed applications from registry
          $apps = @()

          # 64-bit applications
          $apps += Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName } |
            Select-Object DisplayName, Publisher, DisplayVersion, InstallLocation

          # 32-bit applications on 64-bit Windows
          $apps += Get-ItemProperty "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName } |
            Select-Object DisplayName, Publisher, DisplayVersion, InstallLocation

          # Convert to inventory format
          $inventory = $apps | Where-Object { $_.DisplayName } | ForEach-Object {
            @{
              id = [guid]::NewGuid().ToString()
              name = $_.DisplayName
              publisher = if($_.Publisher) { $_.Publisher } else { 'Unknown' }
              version = if($_.DisplayVersion) { $_.DisplayVersion } else { '0.0.0' }
              path = if($_.InstallLocation) { $_.InstallLocation } else { '' }
              type = 'Application'
              isSigned = $false
            }
          } | Select-Object -Unique -Property name, publisher, version, path, type, isSigned, id

          $inventory | ConvertTo-Json -Compress -Depth 3
        } catch {
          '[]'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 60000 });

      if (result.stdout && result.stdout.trim() !== '[]') {
        try {
          const inventory = JSON.parse(result.stdout);
          return Array.isArray(inventory) ? inventory : [inventory];
        } catch (e) {
          console.warn('[IPC] Could not parse inventory:', e);
        }
      }
      return [];
    } catch (error) {
      console.error('[IPC] Get inventory error:', error);
      return [];
    }
  });

  // Get trusted publishers (code signing certificates)
  ipcMain.handle('policy:getTrustedPublishers', async () => {
    try {
      const command = `
        try {
          # Get trusted publishers from certificate store
          $publishers = Get-ChildItem Cert:\\LocalMachine\\TrustedPublisher -ErrorAction SilentlyContinue |
            Select-Object Subject, Issuer, Thumbprint, NotAfter |
            ForEach-Object {
              # Extract CN from Subject
              $cn = if ($_.Subject -match 'CN=([^,]+)') { $matches[1] } else { $_.Subject }
              @{
                id = $_.Thumbprint
                name = $cn
                issuer = if ($_.Issuer -match 'CN=([^,]+)') { $matches[1] } else { $_.Issuer }
                thumbprint = $_.Thumbprint
                expiryDate = $_.NotAfter.ToString('o')
                isTrusted = $true
              }
            }

          if ($publishers) {
            $publishers | ConvertTo-Json -Compress -Depth 3
          } else {
            '[]'
          }
        } catch {
          '[]'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout && result.stdout.trim() !== '[]') {
        try {
          const publishers = JSON.parse(result.stdout);
          return Array.isArray(publishers) ? publishers : [publishers];
        } catch (e) {
          console.warn('[IPC] Could not parse trusted publishers:', e);
        }
      }
      return [];
    } catch (error) {
      console.error('[IPC] Get trusted publishers error:', error);
      return [];
    }
  });

  // Get AppLocker policy groups (rule collections)
  ipcMain.handle('policy:getGroups', async () => {
    try {
      const command = `
        try {
          # Get AppLocker policy and extract rule collections
          $policy = Get-AppLockerPolicy -Effective -ErrorAction SilentlyContinue

          if ($policy) {
            $groups = @()
            foreach ($collection in $policy.RuleCollections) {
              $groups += @{
                name = $collection.RuleCollectionType
                enforcementMode = $collection.EnforcementMode.ToString()
                ruleCount = $collection.Count
              }
            }
            $groups | ConvertTo-Json -Compress
          } else {
            # Return default AppLocker rule collection types
            @(
              @{ name = 'Exe'; enforcementMode = 'NotConfigured'; ruleCount = 0 },
              @{ name = 'Msi'; enforcementMode = 'NotConfigured'; ruleCount = 0 },
              @{ name = 'Script'; enforcementMode = 'NotConfigured'; ruleCount = 0 },
              @{ name = 'Dll'; enforcementMode = 'NotConfigured'; ruleCount = 0 },
              @{ name = 'Appx'; enforcementMode = 'NotConfigured'; ruleCount = 0 }
            ) | ConvertTo-Json -Compress
          }
        } catch {
          '[]'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout && result.stdout.trim() !== '[]') {
        try {
          const groups = JSON.parse(result.stdout);
          // Return just the names for backwards compatibility
          if (Array.isArray(groups)) {
            return groups.map(g => g.name || g);
          }
          return [groups.name || groups];
        } catch (e) {
          console.warn('[IPC] Could not parse policy groups:', e);
        }
      }
      // Default AppLocker collection types
      return ['Exe', 'Msi', 'Script', 'Dll', 'Appx'];
    } catch (error) {
      console.error('[IPC] Get policy groups error:', error);
      return ['Exe', 'Msi', 'Script', 'Dll', 'Appx'];
    }
  });

  // Create a single policy rule
  ipcMain.handle('policy:createRule', async (event, rule) => {
    try {
      if (!rule || !rule.name) {
        return { success: false, error: 'Rule name is required' };
      }

      const ruleId = rule.id || crypto.randomUUID();
      const ruleName = escapePowerShellString(rule.name);
      const ruleType = rule.type || 'Publisher';
      const action = validateEnum(rule.action || 'Allow', ALLOWED_RULE_ACTIONS, 'action');
      const collectionType = validateEnum(rule.collectionType || 'Exe', ALLOWED_COLLECTION_TYPES, 'collectionType');

      let ruleXml = '';

      if (ruleType === 'Publisher' && rule.publisher) {
        const publisher = escapePowerShellString(rule.publisher);
        ruleXml = `
<FilePublisherRule Id="${ruleId}" Name="${ruleName}" Description="${escapePowerShellString(rule.description || '')}" UserOrGroupSid="S-1-1-0" Action="${action}">
  <Conditions>
    <FilePublisherCondition PublisherName="${publisher}" ProductName="*" BinaryName="*">
      <BinaryVersionRange LowSection="*" HighSection="*" />
    </FilePublisherCondition>
  </Conditions>
</FilePublisherRule>`;
      } else if (ruleType === 'Path' && rule.path) {
        const rulePath = escapePowerShellString(rule.path);
        ruleXml = `
<FilePathRule Id="${ruleId}" Name="${ruleName}" Description="${escapePowerShellString(rule.description || '')}" UserOrGroupSid="S-1-1-0" Action="${action}">
  <Conditions>
    <FilePathCondition Path="${rulePath}" />
  </Conditions>
</FilePathRule>`;
      } else if (ruleType === 'Hash' && rule.hash) {
        const hash = escapePowerShellString(rule.hash);
        ruleXml = `
<FileHashRule Id="${ruleId}" Name="${ruleName}" Description="${escapePowerShellString(rule.description || '')}" UserOrGroupSid="S-1-1-0" Action="${action}">
  <Conditions>
    <FileHashCondition>
      <FileHash Type="SHA256" Data="${hash}" SourceFileName="${escapePowerShellString(rule.fileName || 'Unknown')}" SourceFileLength="0" />
    </FileHashCondition>
  </Conditions>
</FileHashRule>`;
      } else {
        return { success: false, error: 'Invalid rule type or missing required fields' };
      }

      // Return the created rule object
      return {
        id: ruleId,
        name: rule.name,
        type: ruleType,
        action: action,
        collectionType: collectionType,
        publisher: rule.publisher,
        path: rule.path,
        hash: rule.hash,
        description: rule.description || '',
        xml: ruleXml.trim(),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[IPC] Create rule error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  // Get current policy XML preview
  ipcMain.handle('policy:getPolicyXML', async (event, phase = 'effective') => {
    try {
      // SECURITY: Validate phase parameter against whitelist (prevents injection)
      const validPhases = ['effective', 'local'];
      if (!validPhases.includes(phase)) {
        return `<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="NotConfigured">
    <!-- Invalid phase parameter -->
  </RuleCollection>
</AppLockerPolicy>`;
      }

      // SECURITY: Use parameter directly in logic, not string interpolation
      const isLocal = phase === 'local';
      const command = `
        try {
          $policy = $null
          if (${isLocal ? '$true' : '$false'}) {
            $policy = Get-AppLockerPolicy -Local -Xml -ErrorAction SilentlyContinue
          } else {
            $policy = Get-AppLockerPolicy -Effective -Xml -ErrorAction SilentlyContinue
          }

          if ($policy) {
            # Format the XML nicely
            $xml = [xml]$policy
            $stringWriter = New-Object System.IO.StringWriter
            $xmlWriter = New-Object System.Xml.XmlTextWriter($stringWriter)
            $xmlWriter.Formatting = [System.Xml.Formatting]::Indented
            $xml.WriteTo($xmlWriter)
            $stringWriter.ToString()
          } else {
            '<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="NotConfigured">
    <!-- No AppLocker policy configured -->
  </RuleCollection>
</AppLockerPolicy>'
          }
        } catch {
          '<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="NotConfigured">
    <!-- Error retrieving policy -->
  </RuleCollection>
</AppLockerPolicy>'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });
      return result.stdout || '';
    } catch (error) {
      console.error('[IPC] Get policy XML error:', error);
      return `<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="NotConfigured">
    <!-- Error retrieving policy -->
  </RuleCollection>
</AppLockerPolicy>`;
    }
  });

  // Create path-based rule
  ipcMain.handle('policy:createPathRule', async (event, options, outputPath) => {
    try {
      if (!isPathAllowed(outputPath)) {
        return { success: false, error: 'Output path not allowed' };
      }

      const rulePath = escapePowerShellString(options.path);
      const ruleName = escapePowerShellString(options.name || options.path);
      const action = options.action || 'Allow';

      const command = `
        try {
          $rule = @"
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <FilePathRule Id="$([guid]::NewGuid())" Name="${ruleName}" Description="Auto-generated path rule" UserOrGroupSid="S-1-1-0" Action="${action}">
      <Conditions>
        <FilePathCondition Path="${rulePath}" />
      </Conditions>
    </FilePathRule>
  </RuleCollection>
</AppLockerPolicy>
"@
          $rule | Out-File -FilePath "${escapePowerShellString(outputPath)}" -Encoding UTF8
          @{ success = $true; outputPath = "${escapePowerShellString(outputPath)}" } | ConvertTo-Json -Compress
        } catch {
          @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        }
      `;

      const result = await executePowerShellCommand(command, { timeout: 30000 });
      return JSON.parse(result.stdout || '{"success":false}');
    } catch (error) {
      console.error('[IPC] Create path rule error:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  });

  console.log('[IPC] IPC handlers registered successfully');
}

module.exports = {
  setupIpcHandlers
};
