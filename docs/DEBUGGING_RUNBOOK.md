# GA-AppLocker Dashboard - Debugging Runbook
## Complete Issue Resolution Guide v1.0

**Project:** GA-AppLocker Dashboard v1.2.4  
**Technology Stack:** Electron + React + TypeScript + PowerShell  
**Last Updated:** 2024-01-12

---

## TABLE OF CONTENTS

1. [Quick Reference](#quick-reference)
2. [Issue Intake & Classification](#issue-intake--classification)
3. [Project-Specific Debugging Strategies](#project-specific-debugging-strategies)
4. [Known Issues & Fixes](#known-issues--fixes)
5. [Debugging Tools & Commands](#debugging-tools--commands)
6. [Fix Documentation Template](#fix-documentation-template)
7. [Verification Checklists](#verification-checklists)

---

## QUICK REFERENCE

### Critical Issues (Fix Immediately)
- **ISSUE-001:** Package.json main entry mismatch (`package.json:7`)
- **ISSUE-012:** DevTools enabled in production (`config/appConfig.cjs:23`)
- **ISSUE-015:** Certificate validation bypass (`electron/security.cjs:64-73`)

### Common Error Patterns
| Error Pattern | Location | Fix Reference |
|--------------|----------|---------------|
| `Cannot find module` | Electron main process | ISSUE-001, ISSUE-002 |
| `NullReferenceException` | React components | ISSUE-007, ISSUE-008 |
| `Unhandled promise rejection` | Async operations | ISSUE-011 |
| `Window not initialized` | WindowManager | ISSUE-003 |
| `Failed to load content` | WindowManager | ISSUE-008 |

### Emergency Contacts
- **Electron Process Crashes:** Check `electron/main.cjs` error handlers
- **React Component Errors:** Check `ErrorBoundary.tsx` logs
- **PowerShell Integration:** Check WinRM connectivity and permissions

---

## ISSUE INTAKE & CLASSIFICATION

### Issue Documentation Template

```markdown
ISSUE ID: GA-APPLOCKER-[NUMBER]
REPORTED BY: [Tester Name]
DATE FOUND: [YYYY-MM-DD]
ENVIRONMENT: [Dev/Test/Staging/Prod]
SEVERITY: [Critical/High/Medium/Low]
PRIORITY: [P1/P2/P3/P4]
STATUS: [New/Investigating/Root Cause Found/Fix In Progress/Fixed/Verified]

SUMMARY:
[One-line description]

STEPS TO REPRODUCE:
1. [Exact step]
2. [Exact step]
3. [Exact step]

EXPECTED BEHAVIOR:
[What should happen]

ACTUAL BEHAVIOR:
[What actually happens]

ERROR MESSAGES:
[Exact error text, stack traces, error codes]

SCREENSHOTS/LOGS:
[Attached evidence]

FREQUENCY:
[Always/Intermittent/Random/Specific conditions]

AFFECTED COMPONENTS:
[Modules, functions, files involved]

REGRESSION:
[Did this work before? When did it break?]

ELECTRON VERSION: [e.g., 32.0.0]
NODE VERSION: [e.g., 20.x]
OS VERSION: [e.g., Windows 10 22H2]
```

### Severity Classification Matrix

**CRITICAL (P1) - Immediate Response**
- App won't start / Electron process crashes
- Security vulnerability (DevTools, certificate validation)
- Data loss / corruption
- Complete feature unusable
- **Response Time:** Immediate, all hands

**HIGH (P2) - Same Day**
- Major feature broken (window loading, navigation)
- Significant user impact
- Workaround exists but painful
- **Response Time:** Same day

**MEDIUM (P3) - This Sprint**
- Minor feature broken
- Limited user impact
- Easy workaround exists
- **Response Time:** This sprint

**LOW (P4) - Backlog**
- Cosmetic issues
- Edge cases
- Minor inconvenience
- **Response Time:** Backlog

---

## PROJECT-SPECIFIC DEBUGGING STRATEGIES

### Electron Main Process Issues

#### Symptoms
- App won't start
- Window doesn't appear
- Module resolution errors
- Process crashes on startup

#### Debugging Approach

**1. Check Entry Point**
```bash
# Verify package.json main entry matches actual file
cat package.json | grep "main"
ls electron/main.*
# Should match: "main": "electron/main.cjs"
```

**2. Enable Electron Debugging**
```javascript
// In electron/main.cjs, add at top:
process.env.ELECTRON_ENABLE_LOGGING = '1';
process.env.DEBUG = 'electron:*';

// Enable verbose logging
app.commandLine.appendSwitch('enable-logging');
```

**3. Check Module Resolution**
```javascript
// Add to electron/main.cjs before requires:
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);

// After each require, log success:
try {
  const module = require('./windowManager.cjs');
  console.log('✓ windowManager.cjs loaded');
} catch (error) {
  console.error('✗ Failed to load windowManager.cjs:', error);
  throw error;
}
```

**4. Window Creation Debugging**
```javascript
// In electron/windowManager.cjs, add logging:
createMainWindow(config = {}) {
  console.log('[WindowManager] Creating window with config:', config);
  
  try {
    this.mainWindow = new BrowserWindow(windowOptions);
    console.log('[WindowManager] Window created successfully');
    
    this.setupWindowHandlers();
    console.log('[WindowManager] Handlers setup complete');
    
    return this.mainWindow;
  } catch (error) {
    console.error('[WindowManager] Failed to create window:', error);
    throw error;
  }
}
```

**5. Content Loading Debugging**
```javascript
// In electron/windowManager.cjs loadContent():
loadContent(urlOrPath, isDev, enableDevToolsInProduction = false) {
  console.log('[WindowManager] Loading content:', {
    urlOrPath,
    isDev,
    enableDevToolsInProduction,
    windowExists: !!this.mainWindow
  });

  if (!this.mainWindow) {
    console.error('[WindowManager] Cannot load: window not initialized');
    return;
  }

  // Add comprehensive error handlers
  this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[WindowManager] Load failed:', {
      errorCode,
      errorDescription,
      validatedURL,
      urlOrPath
    });
  });

  this.mainWindow.webContents.on('did-finish-load', () => {
    console.log('[WindowManager] Content loaded successfully');
  });

  // ... rest of code
}
```

### React Component Issues

#### Symptoms
- Component doesn't render
- State not updating
- Props not received
- Event handlers not firing
- White screen / blank page

#### Debugging Approach

**1. Check Error Boundary**
```typescript
// Verify ErrorBoundary is wrapping App in index.tsx:
import { ErrorBoundary } from './src/presentation/contexts/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

**2. Enable React DevTools**
```typescript
// In App.tsx, add development-only logging:
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[App] Component mounted');
    console.log('[App] Current view:', currentView);
    console.log('[App] About modal:', showAbout);
  }
}, [currentView, showAbout]);
```

**3. Component State Debugging**
```typescript
// Add state logging hook:
function useDebugState<T>(name: string, value: T) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${name}] State changed:`, value);
    }
  }, [name, value]);
}

// Usage:
const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
useDebugState('App.currentView', currentView);
```

**4. Event Handler Debugging**
```typescript
// Wrap event handlers with logging:
const handleKeyDown = (event: KeyboardEvent) => {
  console.log('[App] Key pressed:', {
    key: event.key,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey
  });
  
  // ... original handler code
};
```

**5. Props Debugging**
```typescript
// Add props logging in components:
const Sidebar: React.FC<{currentView: AppView, setView: (view: AppView) => void}> = ({currentView, setView}) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sidebar] Props:', {currentView, setView});
    }
  }, [currentView, setView]);
  
  // ... rest of component
};
```

### TypeScript Compilation Issues

#### Symptoms
- Type errors
- Compilation failures
- Module not found errors
- Import/export mismatches

#### Debugging Approach

**1. Check tsconfig.json**
```bash
# Verify TypeScript configuration
npx tsc --showConfig

# Check for type errors
npx tsc --noEmit
```

**2. Module Resolution Debugging**
```typescript
// Check import paths:
// ❌ Bad: import { something } from './utils'
// ✅ Good: import { something } from './utils/index'

// Use explicit extensions for .cjs files in Electron:
// ❌ Bad: const { WindowManager } = require('./windowManager');
// ✅ Good: const { WindowManager } = require('./windowManager.cjs');
```

**3. Type Safety Checks**
```typescript
// Enable strict mode in tsconfig.json:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### PowerShell Integration Issues

#### Symptoms
- WinRM connection failures
- PowerShell execution errors
- Permission denied errors
- Timeout errors

#### Debugging Approach

**1. Test WinRM Connectivity**
```powershell
# Test WinRM connection
Test-WSMan -ComputerName localhost

# Check WinRM service
Get-Service WinRM

# Enable WinRM if needed (requires admin)
Enable-PSRemoting -Force
```

**2. PowerShell Execution Debugging**
```javascript
// In Electron main process, add PowerShell debugging:
const { exec } = require('child_process');

function executePowerShell(script) {
  return new Promise((resolve, reject) => {
    console.log('[PowerShell] Executing:', script);
    
    const process = exec(
      `powershell.exe -ExecutionPolicy Bypass -Command "${script}"`,
      {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[PowerShell] Error:', error);
          console.error('[PowerShell] Stderr:', stderr);
          reject(error);
          return;
        }
        
        console.log('[PowerShell] Success:', stdout);
        resolve(stdout);
      }
    );
    
    process.on('error', (error) => {
      console.error('[PowerShell] Process error:', error);
      reject(error);
    });
  });
}
```

**3. Error Handling for PowerShell**
```javascript
// Wrap PowerShell calls with proper error handling:
try {
  const result = await executePowerShell(script);
  return JSON.parse(result);
} catch (error) {
  logger.error('PowerShell execution failed', error, {
    script: script.substring(0, 100), // Log first 100 chars
    errorCode: error.code,
    signal: error.signal
  });
  
  // Show user-friendly error
  dialog.showErrorBox(
    'PowerShell Execution Error',
    `Failed to execute PowerShell command: ${error.message}`
  );
  
  throw error;
}
```

### Security Issues

#### Symptoms
- DevTools accessible in production
- Certificate validation bypassed
- Navigation to external URLs allowed
- Context isolation disabled

#### Debugging Approach

**1. Check Security Configuration**
```javascript
// In config/appConfig.cjs, verify:
dev: {
  devToolsInProduction: false, // MUST be false in production
}

// In electron/security.cjs, verify:
webPreferences: {
  nodeIntegration: false,        // MUST be false
  contextIsolation: true,        // MUST be true
  enableRemoteModule: false,     // MUST be false
}
```

**2. Certificate Validation Debugging**
```javascript
// In electron/security.cjs, add logging:
function setupCertificateValidation() {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.log('[Security] Certificate error:', {
      url,
      error: error.message,
      issuer: certificate.issuerName,
      subject: certificate.subjectName
    });
    
    // Implement whitelist-based validation
    const trustedCertificates = getTrustedCertificates();
    const isTrusted = trustedCertificates.some(
      trusted => trusted.fingerprint === certificate.fingerprint
    );
    
    if (isTrusted) {
      console.log('[Security] Certificate trusted via whitelist');
      event.preventDefault();
      callback(true);
    } else {
      console.warn('[Security] Certificate NOT trusted, blocking');
      callback(false);
    }
  });
}
```

**3. Navigation Security Debugging**
```javascript
// In electron/security.cjs, add comprehensive logging:
contents.on('will-navigate', (event, navigationUrl) => {
  try {
    const parsedUrl = new URL(navigationUrl);
    const allowedOrigin = getOrigin();
    
    console.log('[Security] Navigation attempt:', {
      navigationUrl,
      origin: parsedUrl.origin,
      allowedOrigin,
      allowed: parsedUrl.origin === allowedOrigin
    });
    
    if (parsedUrl.origin !== allowedOrigin) {
      console.warn('[Security] Blocked external navigation');
      event.preventDefault();
    }
  } catch (error) {
    console.error('[Security] Invalid URL format, blocking:', navigationUrl);
    event.preventDefault();
  }
});
```

---

## KNOWN ISSUES & FIXES

### ISSUE-001: Package.json Main Entry Mismatch
**SEVERITY:** CRITICAL  
**STATUS:** Fixed  
**LOCATION:** `package.json:7`

**Problem:**
```json
"main": "electron/main.js"  // File doesn't exist
```

**Fix:**
```json
"main": "electron/main.cjs"  // Correct file extension
```

**Verification:**
```bash
npm run electron:dev
# Should start without "Cannot find module" error
```

---

### ISSUE-002: Missing File Extension in Require Statements
**SEVERITY:** HIGH  
**STATUS:** Needs Fix  
**LOCATION:** `electron/main.cjs:2-5`

**Problem:**
Inconsistent use of `.cjs` extensions in require statements.

**Fix:**
```javascript
// Before:
const { WindowManager } = require('./windowManager');
const { setupSecurityHandlers } = require('./security');

// After (consistent with .cjs):
const { WindowManager } = require('./windowManager.cjs');
const { setupSecurityHandlers } = require('./security.cjs');
const { setupAppLifecycle } = require('./appLifecycle.cjs');
const { AppConfig } = require('../config/appConfig.cjs');
```

**Verification:**
```bash
npm run build
npm run electron:test
# Should work in packaged app
```

---

### ISSUE-003: Race Condition in Window Creation
**SEVERITY:** HIGH  
**STATUS:** Needs Fix  
**LOCATION:** `electron/windowManager.cjs:64-83`

**Problem:**
`loadContent()` can be called before window is fully initialized.

**Fix:**
```javascript
loadContent(urlOrPath, isDev, enableDevToolsInProduction = false) {
  if (!this.mainWindow) {
    console.error('[WindowManager] Cannot load content: window not initialized');
    return Promise.reject(new Error('Window not initialized'));
  }

  // Wait for window to be ready
  return new Promise((resolve, reject) => {
    if (this.mainWindow.webContents.isLoading()) {
      this.mainWindow.webContents.once('did-finish-load', () => {
        resolve();
      });
    } else {
      resolve();
    }

    // Remove old listeners before adding new ones
    this.mainWindow.webContents.removeAllListeners('did-fail-load');
    
    this.mainWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('[WindowManager] Failed to load:', {
        errorCode,
        errorDescription,
        validatedURL
      });
      reject(new Error(`Failed to load: ${errorDescription}`));
    });

    if (isDev) {
      this.mainWindow.loadURL(urlOrPath);
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(urlOrPath);
      if (enableDevToolsInProduction) {
        this.mainWindow.webContents.openDevTools();
      }
    }
  });
}
```

**Verification:**
```javascript
// In electron/main.cjs:
async function initializeApp() {
  try {
    const window = windowManager.createMainWindow({...});
    await windowManager.loadContent(url, isDev, AppConfig.dev.devToolsInProduction);
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
}
```

---

### ISSUE-007: Missing Error Handling in Window Creation
**SEVERITY:** HIGH  
**STATUS:** Needs Fix  
**LOCATION:** `electron/windowManager.cjs:34`

**Fix:**
```javascript
createMainWindow(config = {}) {
  const windowOptions = {
    // ... options
  };

  try {
    this.mainWindow = new BrowserWindow(windowOptions);
    this.setupWindowHandlers();
    return this.mainWindow;
  } catch (error) {
    console.error('[WindowManager] Failed to create window:', error);
    // Show error dialog to user
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Window Creation Error',
      `Failed to create application window: ${error.message}`
    );
    throw error;
  }
}
```

---

### ISSUE-008: Missing Error Handling in File Loading
**SEVERITY:** HIGH  
**STATUS:** Needs Fix  
**LOCATION:** `electron/windowManager.cjs:78`

**Fix:**
```javascript
} else {
  try {
    await this.mainWindow.loadFile(urlOrPath);
    if (enableDevToolsInProduction) {
      this.mainWindow.webContents.openDevTools();
    }
  } catch (error) {
    console.error('[WindowManager] Failed to load file:', error);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Content Load Error',
      `Failed to load application content: ${error.message}\n\nPath: ${urlOrPath}`
    );
    // Send error to renderer process
    this.mainWindow.webContents.send('load-error', {
      message: error.message,
      path: urlOrPath
    });
    throw error;
  }
}
```

---

### ISSUE-011: Unhandled Promise Rejection Risk
**SEVERITY:** MEDIUM  
**STATUS:** Needs Fix  
**LOCATION:** `electron/appLifecycle.cjs:18`

**Fix:**
```javascript
app.whenReady()
  .then(() => {
    initializeApp();
  })
  .catch((error) => {
    console.error('[AppLifecycle] App failed to initialize:', error);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Application Error',
      `Failed to start application: ${error.message}`
    );
    app.quit();
  });

// Also add global handlers:
process.on('unhandledRejection', (reason, promise) => {
  console.error('[AppLifecycle] Unhandled promise rejection:', reason);
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  console.error('[AppLifecycle] Uncaught exception:', error);
  logger.error('Uncaught exception', error);
  // Optionally quit app
  // app.quit();
});
```

---

### ISSUE-012: DevTools Enabled in Production
**SEVERITY:** CRITICAL  
**STATUS:** Needs Fix  
**LOCATION:** `config/appConfig.cjs:23`

**Fix:**
```javascript
dev: {
  devToolsInProduction: false, // NEVER enable in production
}
```

**Verification:**
```bash
# Build production version
npm run build
npm run electron:test

# Verify DevTools are NOT accessible
# Try: Ctrl+Shift+I or F12 - should not work
```

---

### ISSUE-015: Certificate Validation Bypass
**SEVERITY:** CRITICAL  
**STATUS:** Needs Fix  
**LOCATION:** `electron/security.cjs:64-73`

**Fix:**
```javascript
function setupCertificateValidation() {
  // Whitelist of trusted certificate fingerprints
  const trustedCertificates = [
    // Add your organization's certificates here
    // { fingerprint: 'SHA256:...', description: 'Internal CA' }
  ];

  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    const fingerprint = certificate.fingerprint;
    
    // Check if certificate is in whitelist
    const isTrusted = trustedCertificates.some(
      trusted => trusted.fingerprint === fingerprint
    );

    if (isTrusted) {
      logger.info('Certificate trusted via whitelist', {
        url,
        issuer: certificate.issuerName,
        subject: certificate.subjectName
      });
      event.preventDefault();
      callback(true);
    } else {
      logger.warn('Certificate NOT trusted, blocking', {
        url,
        error: error.message,
        fingerprint
      });
      callback(false);
    }
  });
}
```

---

## DEBUGGING TOOLS & COMMANDS

### Electron Debugging

**Enable Verbose Logging:**
```bash
# Windows PowerShell
$env:ELECTRON_ENABLE_LOGGING='1'
$env:DEBUG='electron:*'
npm run electron:dev

# Or in package.json script:
"electron:dev:debug": "cross-env ELECTRON_ENABLE_LOGGING=1 DEBUG=electron:* electron ."
```

**Inspect Electron Process:**
```bash
# List Electron processes
Get-Process | Where-Object {$_.ProcessName -like "*electron*"}

# Check process memory
Get-Process electron | Select-Object ProcessName, WorkingSet, CPU
```

**Debug Main Process:**
```javascript
// In electron/main.cjs, add:
const { app } = require('electron');

// Enable debugging
app.commandLine.appendSwitch('remote-debugging-port', '9222');
app.commandLine.appendSwitch('enable-logging');

// Connect Chrome DevTools to: http://localhost:9222
```

**Debug Renderer Process:**
```javascript
// DevTools are automatically available in dev mode
// In production, if needed temporarily:
this.mainWindow.webContents.openDevTools();
```

### React Debugging

**React DevTools:**
```bash
# Install React DevTools browser extension
# Or use standalone: npm install -g react-devtools
react-devtools
```

**Component Profiling:**
```typescript
// Enable React Profiler
import { Profiler } from 'react';

function onRenderCallback(id, phase, actualDuration) {
  console.log('Component:', id, 'Phase:', phase, 'Duration:', actualDuration);
}

<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>
```

### TypeScript Debugging

**Type Checking:**
```bash
# Check types without emitting
npx tsc --noEmit

# Show all errors
npx tsc --noEmit --pretty

# Watch mode
npx tsc --noEmit --watch
```

**Source Maps:**
```typescript
// In vite.config.ts, ensure source maps enabled:
export default defineConfig({
  build: {
    sourcemap: true, // Enable for production debugging
  }
});
```

### PowerShell Debugging

**Test PowerShell Execution:**
```powershell
# Test basic execution
powershell.exe -Command "Get-Process | Select-Object -First 5"

# Test with error handling
powershell.exe -Command "try { Get-Process -Name 'NonExistent' } catch { Write-Error $_.Exception.Message }"

# Test WinRM
Test-WSMan -ComputerName localhost
```

**PowerShell Logging:**
```powershell
# Enable PowerShell transcript
Start-Transcript -Path "C:\Logs\PowerShell-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Your commands here

Stop-Transcript
```

### Network Debugging

**Check Electron Network:**
```javascript
// In electron/main.cjs, add network debugging:
const { session } = require('electron');

session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
  console.log('[Network] Request:', {
    url: details.url,
    method: details.method,
    resourceType: details.resourceType
  });
  callback({});
});
```

---

## FIX DOCUMENTATION TEMPLATE

```markdown
═══════════════════════════════════════════════════════════════
FIX DOCUMENTATION: [ISSUE-ID]
═══════════════════════════════════════════════════════════════

ISSUE ID: GA-APPLOCKER-[NUMBER]
FIX DATE: [YYYY-MM-DD]
FIXED BY: [Developer Name]
REVIEWED BY: [Reviewer Name]

ROOT CAUSE:
[Detailed explanation of why the bug occurred]

AFFECTED FILES:
- path/to/file1.tsx (lines 42-56)
- path/to/file2.cjs (lines 100-120)

CHANGES MADE:
1. [Specific change with rationale]
2. [Specific change with rationale]
3. [Specific change with rationale]

CODE DIFF:
```diff
--- a/path/to/file.tsx
+++ b/path/to/file.tsx
@@ -10,7 +10,9 @@ function Component() {
-  const value = getValue(); // Could be null
+  const value = getValue();
+  if (!value) {
+    throw new Error('Value is required');
+  }
```

TESTING PERFORMED:
- [x] Original reproduction steps verified fixed
- [x] Unit tests added/updated
- [x] Integration tests pass
- [x] Manual testing completed
- [x] Edge cases verified
- [x] Regression testing completed

REGRESSION RISK:
[Low/Medium/High] - [Explanation]

RELATED ISSUES:
- [Links to similar issues]

DEPLOYMENT NOTES:
[Any special deployment considerations]

MONITORING:
[What to watch for after deployment]

VERIFICATION:
- [x] Code review completed
- [x] All review comments addressed
- [x] CI/CD pipeline passes
- [x] Test coverage maintained or improved
- [x] Documentation updated

═══════════════════════════════════════════════════════════════
```

---

## VERIFICATION CHECKLISTS

### Pre-Commit Verification
- [ ] Code compiles without errors (`npm run build`)
- [ ] Code compiles without new warnings
- [ ] TypeScript type checking passes (`npx tsc --noEmit`)
- [ ] All existing tests pass
- [ ] New tests added for the fix
- [ ] Edge cases have test coverage
- [ ] Code follows style guidelines
- [ ] No debug code left in (console.log removed or wrapped in dev check)
- [ ] No hardcoded values for testing
- [ ] Changes are minimal and focused
- [ ] Comments explain the "why" not just "what"
- [ ] Error handling is comprehensive
- [ ] Security implications reviewed

### Pre-Merge Verification
- [ ] Code review completed
- [ ] All review comments addressed
- [ ] CI/CD pipeline passes
- [ ] Test coverage maintained or improved
- [ ] Performance benchmarks pass (if applicable)
- [ ] Security scan passes
- [ ] Documentation updated if needed
- [ ] Changelog updated

### Post-Deployment Verification
- [ ] Original reporter verified fix
- [ ] Smoke tests pass in target environment
- [ ] No new errors in logs
- [ ] Monitoring shows normal behavior
- [ ] Related features still work
- [ ] Performance metrics normal
- [ ] No memory leaks detected
- [ ] Electron process stability confirmed

### Electron-Specific Verification
- [ ] App starts successfully (`npm run electron:dev`)
- [ ] Window appears and loads content
- [ ] No console errors in main process
- [ ] No console errors in renderer process
- [ ] DevTools work in dev mode (if applicable)
- [ ] DevTools disabled in production
- [ ] Security settings verified (context isolation, node integration)
- [ ] Certificate validation working
- [ ] Navigation security working

### React-Specific Verification
- [ ] All components render correctly
- [ ] No React warnings in console
- [ ] Error boundaries catch errors appropriately
- [ ] State management works correctly
- [ ] Event handlers fire correctly
- [ ] Navigation works (keyboard shortcuts, sidebar)
- [ ] Modal dialogs work correctly
- [ ] No memory leaks (check React DevTools Profiler)

---

## APPENDIX: QUICK DEBUGGING COMMANDS

### Windows PowerShell

```powershell
# Check Electron processes
Get-Process | Where-Object {$_.ProcessName -like "*electron*"}

# Kill all Electron processes
Get-Process | Where-Object {$_.ProcessName -like "*electron*"} | Stop-Process -Force

# Check Node version
node --version

# Check npm version
npm --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# Build and test
npm run build
npm run electron:test

# Check for TypeScript errors
npx tsc --noEmit

# Run with verbose logging
$env:ELECTRON_ENABLE_LOGGING='1'
npm run electron:dev
```

### Git Commands

```bash
# Find when bug was introduced
git bisect start
git bisect bad
git bisect good <commit-hash>
# Test, then:
git bisect good  # or git bisect bad
# Repeat until found

# Check file history
git log --follow -- path/to/file.tsx

# See what changed
git diff <commit-hash> path/to/file.tsx
```

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-12  
**Maintained By:** GA-ASI Development Team
