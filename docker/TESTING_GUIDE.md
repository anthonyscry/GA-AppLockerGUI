# Docker Testing Guide for GA-AppLocker Dashboard

## Overview

This guide explains how to test the GA-AppLocker Dashboard application using Docker containers. Note that **Electron requires a GUI**, so full Electron testing requires either:
1. Windows containers with RDP/VNC access
2. Headless testing of individual components
3. Testing the React app (Vite dev server) separately

## Testing Strategy

### ✅ What CAN Be Tested in Docker

1. **React Application (Vite Dev Server)**
   - Full React app runs in browser
   - All UI components
   - State management
   - Component interactions
   - Accessible at `http://localhost:3000`

2. **PowerShell Scripts**
   - All `.ps1` scripts can be tested
   - AppLocker module functions
   - Policy generation
   - Rule validation

3. **Backend Services (via IPC simulation)**
   - Service layer logic
   - Data processing
   - Business logic validation

4. **Active Directory Integration**
   - LDAP connections
   - User/group queries
   - Domain authentication

5. **WinRM Remote Scanning**
   - Remote PowerShell execution
   - Inventory collection
   - Event log retrieval

### ⚠️ What CANNOT Be Tested in Docker (Without GUI)

1. **Full Electron App**
   - Electron window rendering
   - Native dialogs
   - System tray
   - File system dialogs

2. **IPC Communication (Full Stack)**
   - Requires Electron main process
   - Can be mocked for testing

## Quick Start Testing

### Option 1: Test React App Only (Recommended)

```powershell
# Start Docker environment
cd docker
docker-compose up -d

# Enter app container
docker exec -it ga-applocker-app powershell

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Then access the app at `http://localhost:3000` in your browser.

### Option 2: Test PowerShell Scripts

```powershell
# Enter app container
docker exec -it ga-applocker-app powershell

# Test a script
cd scripts
.\Test-RuleHealth.ps1 -PolicyPath "C:\path\to\policy.xml"

# Test rule generation
.\New-RulesFromInventory.ps1 -InventoryPath "inventory.csv" -OutputPath "output.xml"
```

### Option 3: Windows Containers (Full AppLocker Support)

```powershell
# Switch to Windows containers in Docker Desktop
# Then use Windows compose file
cd docker
docker-compose -f docker-compose.windows.yml up -d

# Enter Windows container
docker exec -it ga-applocker-app powershell

# Install dependencies
npm install

# Build the app
npm run build

# Note: Electron GUI won't work without display server
# But you can test:
# - React app via browser (npm run dev)
# - PowerShell scripts
# - AD integration
```

## Testing Scenarios

### 1. Test React Components

```powershell
# In app container
npm run dev

# Access in browser: http://localhost:3000
# Test all UI components, navigation, forms, etc.
```

### 2. Test PowerShell Scripts

```powershell
# Test policy health check
.\scripts\Test-RuleHealth.ps1

# Test rule generation
.\scripts\New-RulesFromInventory.ps1 -InventoryPath "test.csv" -OutputPath "test.xml"

# Test batch generation
.\scripts\Generate-BatchRules.ps1 -InventoryItems $items -OutputPath "batch.xml"
```

### 3. Test AD Integration

```powershell
# Test LDAP connection
$ldap = "LDAP://domain-controller:389"
# Use AD PowerShell cmdlets to query users/groups

# Test WinRM
$cred = Get-Credential
Invoke-Command -ComputerName windows-client -Port 5985 -Credential $cred -ScriptBlock { Get-Process }
```

### 4. Test API/Service Layer

```powershell
# Create test script to exercise services
# Test MachineService, PolicyService, etc.
```

## Limitations

### Electron GUI Testing

**Challenge:** Electron requires a display server to render windows.

**Solutions:**
1. **Use Browser Testing:** Test React app via Vite dev server (works great!)
2. **Mock IPC:** Test React components with mocked `window.electron` API
3. **Headless Electron:** Use `electron` with `--headless` flag (if supported)
4. **VNC/RDP:** Set up VNC server in Windows container for remote GUI access

### Recommended Approach

For **automated testing**, focus on:
1. ✅ React component unit tests
2. ✅ PowerShell script testing
3. ✅ Service layer integration tests
4. ✅ API endpoint testing

For **manual testing**:
1. ✅ Use Vite dev server in Docker (browser access)
2. ✅ Test Electron locally on Windows host
3. ✅ Use Windows containers for AppLocker-specific features

## Example Test Commands

```powershell
# Start environment
cd docker
docker-compose up -d

# Wait for services
Start-Sleep -Seconds 30

# Enter container
docker exec -it ga-applocker-app powershell

# Test build
npm run build

# Test dev server
npm run dev
# Access at http://localhost:3000

# Test scripts
cd scripts
.\Test-RuleHealth.ps1
.\New-RulesFromInventory.ps1 -InventoryPath "test.csv" -OutputPath "test.xml"
```

## Notes

- **Windows Containers Required** for full AppLocker functionality
- **React App** can be fully tested via browser
- **Electron GUI** requires display server or local testing
- **PowerShell Scripts** can be fully tested in containers
- **AD Integration** works with Samba AD (Linux) or Windows AD (Windows containers)
