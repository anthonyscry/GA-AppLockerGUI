/**
 * PowerShell Execution Handler
 * Provides secure execution of PowerShell scripts from the Electron main process
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute a PowerShell script and return the result
 * @param {string} scriptPath - Path to PowerShell script
 * @param {string[]} args - Arguments to pass to the script
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Result with stdout, stderr, and exit code
 */
function executePowerShellScript(scriptPath, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const {
      timeout = 300000, // 5 minutes default timeout
      workingDirectory = process.cwd(),
      encoding = 'utf8',
      env = process.env // Support custom environment variables
    } = options;

    // Resolve script path
    const fullScriptPath = path.isAbsolute(scriptPath) 
      ? scriptPath 
      : path.resolve(workingDirectory, scriptPath);

    // Verify script exists
    if (!fs.existsSync(fullScriptPath)) {
      reject(new Error(`PowerShell script not found: ${fullScriptPath}`));
      return;
    }

    // Determine PowerShell executable
    const powershellExe = process.platform === 'win32' 
      ? 'powershell.exe' 
      : 'pwsh';

    // Build command arguments
    const psArgs = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', fullScriptPath,
      ...args
    ];

    // Spawn PowerShell process
    const psProcess = spawn(powershellExe, psArgs, {
      cwd: workingDirectory,
      encoding: encoding,
      shell: false,
      windowsVerbatimArguments: true,
      env: env // Pass custom environment variables
    });

    let stdout = '';
    let stderr = '';
    let timeoutId = null;

    // Handle timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        psProcess.kill();
        reject(new Error(`PowerShell script execution timeout after ${timeout}ms: ${fullScriptPath}`));
      }, timeout);
    }

    // Collect stdout
    psProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    psProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process exit
    psProcess.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const result = {
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
      };

      if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(`PowerShell script failed with exit code ${code}:\n${stderr || stdout}`));
      }
    });

    // Handle process errors
    psProcess.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(new Error(`Failed to spawn PowerShell process: ${error.message}`));
    });
  });
}

/**
 * Execute PowerShell command (inline script)
 * @param {string} command - PowerShell command/script block
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Result with stdout, stderr, and exit code
 */
function executePowerShellCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      timeout = 60000, // 1 minute default for commands
      workingDirectory = process.cwd(),
      encoding = 'utf8'
    } = options;

    const powershellExe = process.platform === 'win32' 
      ? 'powershell.exe' 
      : 'pwsh';

    const psArgs = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', command
    ];

    const psProcess = spawn(powershellExe, psArgs, {
      cwd: workingDirectory,
      encoding: encoding,
      shell: false,
      windowsVerbatimArguments: true
    });

    let stdout = '';
    let stderr = '';
    let timeoutId = null;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        psProcess.kill();
        reject(new Error(`PowerShell command execution timeout after ${timeout}ms`));
      }, timeout);
    }

    psProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    psProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    psProcess.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const result = {
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
      };

      if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(`PowerShell command failed with exit code ${code}:\n${stderr || stdout}`));
      }
    });

    psProcess.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(new Error(`Failed to spawn PowerShell process: ${error.message}`));
    });
  });
}

/**
 * Get the scripts directory path
 * @returns {string} Path to scripts directory
 */
function getScriptsDirectory() {
  // In production, scripts are in the app directory
  // In development, scripts are in the project root
  if (process.env.NODE_ENV === 'production') {
    return path.join(process.resourcesPath, 'scripts');
  }
  return path.resolve(__dirname, '../../scripts');
}

/**
 * Escape PowerShell special characters to prevent injection
 * @param {string} input - String to escape
 * @returns {string} Escaped string safe for PowerShell
 */
function escapePowerShellString(input) {
  if (typeof input !== 'string') return '';
  // Escape backticks, single quotes, double quotes, dollar signs
  return input
    .replace(/`/g, '``')
    .replace(/"/g, '`"')
    .replace(/\$/g, '`$')
    .replace(/'/g, "''");
}

/**
 * Validate module name to prevent injection attacks
 * @param {string} moduleName - Module name to validate
 * @returns {boolean} True if module name is valid
 */
function isValidModuleName(moduleName) {
  // Module names should only contain alphanumeric characters, dots, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return typeof moduleName === 'string' &&
         moduleName.length > 0 &&
         moduleName.length <= 256 &&
         validPattern.test(moduleName);
}

/**
 * Check if PowerShell module is available
 * @param {string} moduleName - Module name to check
 * @returns {Promise<boolean>} True if module is available
 */
async function checkPowerShellModule(moduleName) {
  try {
    // Validate module name to prevent command injection
    if (!isValidModuleName(moduleName)) {
      console.warn(`[PowerShell] Invalid module name rejected: ${moduleName}`);
      return false;
    }

    // Use escaped string in command
    const escapedModuleName = escapePowerShellString(moduleName);
    const command = `if (Get-Module -ListAvailable -Name "${escapedModuleName}") { exit 0 } else { exit 1 }`;
    await executePowerShellCommand(command, { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  executePowerShellScript,
  executePowerShellCommand,
  getScriptsDirectory,
  checkPowerShellModule,
  escapePowerShellString,
  isValidModuleName
};
