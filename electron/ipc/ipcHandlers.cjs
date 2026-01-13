/**
 * IPC Handlers for GA-AppLocker Dashboard
 * Handles communication between renderer and main process
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

  // Default allowed roots
  const defaultAllowedRoots = [
    process.cwd(),
    require('os').tmpdir(),
    require('os').homedir(),
    path.join(require('os').homedir(), 'Documents'),
    path.join(require('os').homedir(), 'AppData'),
    'C:\\AppLockerBackups',
    'C:\\AppLocker'
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
        error: error.message
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

      // NEW: Support OU linking
      if (options.ouPaths && Array.isArray(options.ouPaths) && options.ouPaths.length > 0) {
        args.push('-OUPath');
        args.push(options.ouPaths.join(','));
      }

      // NEW: Support phase-based deployment
      if (options.phase) {
        args.push('-Phase', options.phase);
      }

      // NEW: Support enforcement mode override
      if (options.enforcementMode) {
        args.push('-EnforcementMode', options.enforcementMode);
      }

      // NEW: Auto-create GPO if needed
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
        error: error.message
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
        Error: error.message
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

      // Add credentials if provided
      if (options.credentials && !options.credentials.useCurrentUser) {
        if (options.credentials.username) {
          artifactArgs.push('-Username', options.credentials.username);
        }
        if (options.credentials.password) {
          artifactArgs.push('-Password', options.credentials.password);
        }
        if (options.credentials.domain) {
          artifactArgs.push('-Domain', options.credentials.domain);
        }
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
        error: error.message
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
        error: error.message
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
        error: error.message
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
        error: error.message
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

  // ============================================
  // AD HANDLERS (Active Directory Operations)
  // ============================================

  // Get all AD users (query from Active Directory)
  ipcMain.handle('ad:getUsers', async () => {
    try {
      const command = `
        try {
          $users = Get-ADUser -Filter * -Properties DisplayName, Title, Department, EmailAddress, Enabled, MemberOf |
            Select-Object -First 100 SamAccountName, DisplayName, Title, Department, EmailAddress, Enabled,
              @{N='Groups';E={($_.MemberOf | ForEach-Object { ($_ -split ',')[0] -replace 'CN=' }) -join ';'}} |
            ConvertTo-Json -Compress
          $users
        } catch {
          '[]'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout && result.stdout.trim() !== '[]') {
        try {
          const users = JSON.parse(result.stdout);
          return Array.isArray(users) ? users : [users];
        } catch (e) {
          console.warn('[IPC] Could not parse AD users:', e);
        }
      }
      return [];
    } catch (error) {
      console.error('[IPC] Get AD users error:', error);
      return [];
    }
  });

  // Get user by ID
  ipcMain.handle('ad:getUserById', async (event, userId) => {
    try {
      const safeUserId = escapePowerShellString(userId);
      const command = `
        try {
          Get-ADUser -Identity "${safeUserId}" -Properties DisplayName, Title, Department, EmailAddress, Enabled, MemberOf |
            Select-Object SamAccountName, DisplayName, Title, Department, EmailAddress, Enabled,
              @{N='Groups';E={($_.MemberOf | ForEach-Object { ($_ -split ',')[0] -replace 'CN=' }) -join ';'}} |
            ConvertTo-Json -Compress
        } catch {
          'null'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 15000 });

      if (result.stdout && result.stdout.trim() !== 'null') {
        return JSON.parse(result.stdout);
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
        try {
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
      return { success: false, error: error.message };
    }
  });

  // Remove user from AD group
  ipcMain.handle('ad:removeFromGroup', async (event, userId, groupName) => {
    try {
      const safeUserId = escapePowerShellString(userId);
      const safeGroupName = escapePowerShellString(groupName);

      const command = `
        try {
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
      return { success: false, error: error.message };
    }
  });

  // Get AD groups (AppLocker-related)
  ipcMain.handle('ad:getGroups', async () => {
    try {
      const command = `
        try {
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
        'AppLocker-Exempt-Users',
        'AppLocker-Developers',
        'AppLocker-Standard-Users',
        'AppLocker-Audit-Only'
      ];
    } catch (error) {
      console.error('[IPC] Get AD groups error:', error);
      return [];
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
      return { status: 'Unknown', error: error.message };
    }
  });

  // Toggle WinRM GPO
  ipcMain.handle('ad:toggleWinRMGPO', async (event, enable) => {
    try {
      const scriptsDir = getScriptsDirectory();
      const scriptPath = path.join(scriptsDir, enable ? 'Enable-WinRMGPO.ps1' : 'Disable-WinRMGPO.ps1');

      // Check if script exists, otherwise use inline command
      if (fs.existsSync(scriptPath)) {
        const result = await executePowerShellScript(scriptPath, [], { timeout: 300000 });
        return { success: true, output: result.stdout };
      } else {
        // Inline implementation
        const command = enable ? `
          try {
            $gpoName = "Enable-WinRM"
            $gpo = Get-GPO -Name $gpoName -ErrorAction SilentlyContinue
            if (-not $gpo) {
              $gpo = New-GPO -Name $gpoName -Comment "Enables WinRM for remote management"
            }
            # Configure WinRM settings via GPO
            Set-GPRegistryValue -Name $gpoName -Key "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WinRM\\Service" -ValueName "AllowAutoConfig" -Type DWord -Value 1
            Set-GPRegistryValue -Name $gpoName -Key "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WinRM\\Service" -ValueName "IPv4Filter" -Type String -Value "*"
            @{ success = $true } | ConvertTo-Json -Compress
          } catch {
            @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
          }
        ` : `
          try {
            $gpoName = "Enable-WinRM"
            $gpo = Get-GPO -Name $gpoName -ErrorAction SilentlyContinue
            if ($gpo) {
              $gpo.GpoStatus = 'AllSettingsDisabled'
            }
            @{ success = $true } | ConvertTo-Json -Compress
          } catch {
            @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
          }
        `;

        const result = await executePowerShellCommand(command, { timeout: 300000 });
        return JSON.parse(result.stdout || '{"success":false}');
      }
    } catch (error) {
      console.error('[IPC] Toggle WinRM GPO error:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // MACHINE HANDLERS (Remote Scanning)
  // ============================================

  // Get all machines from AD
  ipcMain.handle('machine:getAll', async () => {
    try {
      const command = `
        try {
          $computers = Get-ADComputer -Filter * -Properties OperatingSystem, LastLogonDate, DistinguishedName, Description |
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
            } | ConvertTo-Json -Compress
          $computers
        } catch {
          '[]'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 60000 });

      if (result.stdout && result.stdout.trim() !== '[]') {
        try {
          const machines = JSON.parse(result.stdout);
          return Array.isArray(machines) ? machines : [machines];
        } catch (e) {
          console.warn('[IPC] Could not parse machines:', e);
        }
      }
      return [];
    } catch (error) {
      console.error('[IPC] Get all machines error:', error);
      return [];
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
      if (options.targetOUs && options.targetOUs.length > 0) {
        args.push('-TargetOUs', options.targetOUs.join(','));
      }
      if (options.computerNames && options.computerNames.length > 0) {
        args.push('-ComputerNames', options.computerNames.join(','));
      }

      const result = await executePowerShellScript(scanScriptPath, args, {
        timeout: options.timeout || 600000
      });

      return { success: true, output: result.stdout };
    } catch (error) {
      console.error('[IPC] Start scan error:', error);
      return { success: false, error: error.message };
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
            "${env:ProgramFiles(x86)}",
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

      const result = await executePowerShellCommand(command, { timeout: 120000 });

      if (result.stdout) {
        return JSON.parse(result.stdout);
      }
      return { success: false, error: 'No output from scan' };
    } catch (error) {
      console.error('[IPC] Local scan error:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // EVENT HANDLERS (AppLocker Audit Logs)
  // ============================================

  // Get all AppLocker events
  ipcMain.handle('event:getAll', async () => {
    try {
      const command = `
        try {
          $events = Get-WinEvent -LogName "Microsoft-Windows-AppLocker/EXE and DLL" -MaxEvents 100 -ErrorAction SilentlyContinue |
            Select-Object Id, TimeCreated, Message, @{N='Computer';E={$env:COMPUTERNAME}} |
            ForEach-Object {
              @{
                id = [guid]::NewGuid().ToString()
                eventId = $_.Id
                timestamp = $_.TimeCreated.ToString('o')
                message = $_.Message
                machineName = $_.Computer
                severity = if($_.Id -eq 8004) { 'Blocked' } elseif($_.Id -eq 8003) { 'Warning' } else { 'Info' }
              }
            } | ConvertTo-Json -Compress
          if ($events) { $events } else { '[]' }
        } catch {
          '[]'
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout && result.stdout.trim() !== '[]') {
        try {
          const events = JSON.parse(result.stdout);
          return Array.isArray(events) ? events : [events];
        } catch (e) {
          console.warn('[IPC] Could not parse events:', e);
        }
      }
      return [];
    } catch (error) {
      console.error('[IPC] Get events error:', error);
      return [];
    }
  });

  // Get event statistics
  ipcMain.handle('event:getStats', async () => {
    try {
      const command = `
        try {
          $events = Get-WinEvent -LogName "Microsoft-Windows-AppLocker/EXE and DLL" -MaxEvents 1000 -ErrorAction SilentlyContinue
          $blocked = ($events | Where-Object { $_.Id -eq 8004 }).Count
          $warnings = ($events | Where-Object { $_.Id -eq 8003 }).Count
          $allowed = ($events | Where-Object { $_.Id -eq 8002 }).Count

          @{
            totalBlocked = $blocked
            totalWarnings = $warnings
            totalAllowed = $allowed
            totalEvents = $events.Count
          } | ConvertTo-Json -Compress
        } catch {
          @{ totalBlocked = 0; totalWarnings = 0; totalAllowed = 0; totalEvents = 0 } | ConvertTo-Json -Compress
        }
      `;
      const result = await executePowerShellCommand(command, { timeout: 30000 });

      if (result.stdout) {
        return JSON.parse(result.stdout);
      }
      return { totalBlocked: 0, totalWarnings: 0, totalAllowed: 0, totalEvents: 0 };
    } catch (error) {
      console.error('[IPC] Get event stats error:', error);
      return { totalBlocked: 0, totalWarnings: 0, totalAllowed: 0, totalEvents: 0 };
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
          Get-WinEvent -LogName "Microsoft-Windows-AppLocker/EXE and DLL" -MaxEvents 5000 -ErrorAction SilentlyContinue |
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
      return { success: false, error: error.message };
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

      const safeOutputPath = escapePowerShellString(outputPath);
      const safeSystemName = escapePowerShellString(systemName || '');

      const command = `
        try {
          # Create output directory if needed
          $outputDir = Split-Path -Parent "${safeOutputPath}"
          if (${createFolderIfMissing ? '$true' : '$false'} -and -not (Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
          }

          # Export AppLocker events to EVTX format
          $logNames = @(
            'Microsoft-Windows-AppLocker/EXE and DLL',
            'Microsoft-Windows-AppLocker/MSI and Script',
            'Microsoft-Windows-AppLocker/Packaged app-Deployment',
            'Microsoft-Windows-AppLocker/Packaged app-Execution'
          )

          $tempEvtx = [System.IO.Path]::GetTempFileName() + '.evtx'

          foreach ($logName in $logNames) {
            try {
              $log = Get-WinEvent -LogName $logName -MaxEvents 1 -ErrorAction SilentlyContinue
              if ($log) {
                # Export the log using wevtutil
                wevtutil epl "$logName" "${safeOutputPath}" /ow:true 2>$null
                break
              }
            } catch {
              # Try next log
            }
          }

          if (Test-Path "${safeOutputPath}") {
            @{
              success = $true
              outputPath = "${safeOutputPath}"
              systemName = "${safeSystemName}"
              timestamp = (Get-Date).ToString('o')
            } | ConvertTo-Json -Compress
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

      const result = await executePowerShellCommand(command, { timeout: 60000 });

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
      const evidenceDir = path.join(process.cwd(), 'compliance');

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

  // Generate evidence package
  ipcMain.handle('compliance:generateEvidence', async (event, options = {}) => {
    try {
      const scriptsDir = getScriptsDirectory();
      const scriptPath = path.join(scriptsDir, 'Export-ComplianceEvidence.ps1');

      const outputDir = options.outputDirectory || path.join(process.cwd(), 'compliance');
      const args = ['-OutputDirectory', outputDir];

      if (fs.existsSync(scriptPath)) {
        const result = await executePowerShellScript(scriptPath, args, { timeout: 300000 });
        return { success: true, path: outputDir, output: result.stdout };
      }

      // Create evidence directory structure
      const dirs = ['policies', 'audit-logs', 'snapshots', 'reports'];
      for (const dir of dirs) {
        const dirPath = path.join(outputDir, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }

      return { success: true, path: outputDir };
    } catch (error) {
      console.error('[IPC] Generate evidence error:', error);
      return { success: false, error: error.message };
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
      return { isValid: false, missingItems: ['Validation failed'], warnings: [error.message] };
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
      return { success: false, error: error.message };
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
      return { success: false, error: error.message };
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
      return { success: false, error: error.message };
    }
  });

  // Get current policy XML preview
  ipcMain.handle('policy:getPolicyXML', async (event, phase = 'effective') => {
    try {
      const command = `
        try {
          $policy = $null
          if ("${phase}" -eq "local") {
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
    <!-- Error retrieving policy: ' + $_.Exception.Message + ' -->
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
    <!-- Error: ${error.message} -->
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
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] IPC handlers registered successfully');
}

module.exports = {
  setupIpcHandlers
};
