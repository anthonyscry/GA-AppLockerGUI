# GA-AppLocker Dashboard - Technical Summary

**Version:** 1.2.10
**Last Updated:** 2026-01-14
**Platform:** Windows (Electron + React + TypeScript)

---

## Executive Summary

GA-AppLocker Dashboard is an enterprise Windows application for managing AppLocker policies across Active Directory environments. It provides a GUI for:
- Remote software inventory scanning via WinRM
- AppLocker rule generation (Publisher, Hash, Path)
- Policy deployment via Group Policy Objects
- Event monitoring (8001-8004 audit events)
- AD user/group management for AppLocker security groups
- NIST 800-53 compliance evidence generation

**Critical Requirement:** Must run on a **Windows Server with Active Directory** and **Domain Admin privileges** for full functionality.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│  React 19.2 + TypeScript + Tailwind CSS                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐         │
│  │ ScanModule  │ PolicyModule│ EventsModule│ ADManager   │         │
│  │ RuleGen     │ Compliance  │ Dashboard   │ Compare     │         │
│  └─────────────┴─────────────┴─────────────┴─────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                                 │ IPC (contextBridge)
┌─────────────────────────────────────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                       │
│  ipcHandlers.cjs (60+ handlers) + powerShellHandler.cjs            │
└─────────────────────────────────────────────────────────────────────┘
                                 │ Child Process (spawn)
┌─────────────────────────────────────────────────────────────────────┐
│                         POWERSHELL EXECUTION                        │
│  ActiveDirectory Module | GroupPolicy Module | WinRM                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
GA-AppLockerGUI/
├── App.tsx                      # Main app component, navigation, help modal
├── index.tsx                    # React entry point with DI container
├── constants.tsx                # NAVIGATION items, APPLOCKER_GROUPS
│
├── components/                  # React UI modules
│   ├── Dashboard.tsx            # Overview stats, charts
│   ├── ScanModule.tsx           # Remote scanning, WinRM, machine detection
│   ├── RuleGeneratorModule.tsx  # Rule creation from artifacts
│   ├── PolicyModule.tsx         # Policy tools, merge, deploy, health check
│   ├── EventsModule.tsx         # Event monitor, backup, export
│   ├── ADManagementModule.tsx   # User/group management with checkboxes
│   ├── ComplianceModule.tsx     # NIST evidence packages
│   ├── InventoryCompareModule.tsx # Software diff between snapshots
│   └── ui/                      # Reusable UI components
│
├── electron/
│   ├── main.cjs                 # Electron entry, window creation
│   ├── preload.cjs              # contextBridge IPC exposure
│   ├── windowManager.cjs        # Window lifecycle management
│   ├── security.cjs             # CSP, certificate validation
│   └── ipc/
│       ├── ipcHandlers.cjs      # ALL IPC handlers (60+)
│       └── powerShellHandler.cjs # PowerShell execution wrapper
│
├── scripts/                     # PowerShell automation scripts
│   ├── Enable-WinRMGPO.ps1      # Create WinRM GPO for domain
│   ├── Start-BatchScan.ps1      # Multi-machine scanning
│   ├── Deploy-AppLockerPolicy.ps1 # GPO policy deployment
│   └── [12 more scripts]
│
├── src/
│   ├── domain/interfaces/       # Repository contracts
│   ├── infrastructure/
│   │   ├── repositories/        # IPC-backed data access
│   │   ├── ipc/channels.ts      # Type-safe channel definitions
│   │   └── di/                  # Dependency injection
│   ├── application/services/    # Business logic layer
│   └── shared/types/            # TypeScript interfaces
│
└── docs/                        # Documentation
```

---

## IPC Handler Reference

### Machine/Scanning Handlers

| Handler | Purpose | PowerShell Required |
|---------|---------|---------------------|
| `machine:getAll` | Query AD computers (Get-ADComputer) | ActiveDirectory |
| `machine:getById` | Get single machine details | ActiveDirectory |
| `machine:startScan` | WinRM remote scan | WinRM enabled |
| `scan:local` | Scan local machine | None |

### AD Handlers

| Handler | Purpose | PowerShell Required |
|---------|---------|---------------------|
| `ad:getUsers` | Query AD users (Get-ADUser) | ActiveDirectory |
| `ad:getUserById` | Get user by ID | ActiveDirectory |
| `ad:addToGroup` | Add-ADGroupMember | ActiveDirectory |
| `ad:removeFromGroup` | Remove-ADGroupMember | ActiveDirectory |
| `ad:getGroups` | Get AppLocker-related groups | ActiveDirectory |
| `ad:createAppLockerGroups` | Create 5 security groups | ActiveDirectory |
| `ad:toggleWinRMGPO` | Enable/disable WinRM GPO | GroupPolicy |
| `ad:getOUsWithComputers` | List OUs with computers | ActiveDirectory |
| `ad:getOUsWithUsers` | List OUs with users | ActiveDirectory |

### Event Handlers

| Handler | Purpose | PowerShell Required |
|---------|---------|---------------------|
| `event:getAll` | Get-WinEvent AppLocker logs | None (local) |
| `event:getStats` | Calculate event statistics | None |
| `event:exportCSV` | Export events to CSV | None |
| `events:backup` | Export to EVTX/XML | None |
| `events:collectAuditLogs` | Collect from remote systems | WinRM |

### Policy Handlers

| Handler | Purpose | PowerShell Required |
|---------|---------|---------------------|
| `policy:runHealthCheck` | Validate rule health | None |
| `policy:deploy` | Deploy via GPO | GroupPolicy |
| `policy:mergePolicies` | Merge XML policies | None |
| `policy:generateFromArtifacts` | Create rules from scan | None |
| `policy:batchGenerateRules` | Bulk rule generation | None |
| `policy:validateRules` | XML validation | None |
| `policy:createPublisherRule` | Create publisher rule | None |
| `policy:createPathRule` | Create path rule | None |

### System/Utility Handlers

| Handler | Purpose |
|---------|---------|
| `system:getUserInfo` | Get current Windows user |
| `system:getDomainInfo` | Get domain FQDN, DC status |
| `dialog:showOpenDialog` | File picker |
| `dialog:showSaveDialog` | Save dialog |
| `fs:writeFile` | Write file to disk |
| `file:ensureDirectory` | Create directory |

---

## PowerShell Module Dependencies

```powershell
# Required for AD operations
Import-Module ActiveDirectory

# Required for GPO operations
Import-Module GroupPolicy

# Verify installation
Get-Module -ListAvailable ActiveDirectory, GroupPolicy
```

**Installation on Server 2019:**
```powershell
Install-WindowsFeature RSAT-AD-PowerShell
Install-WindowsFeature GPMC
```

---

## AppLocker Security Groups

The application manages 5 security groups:

| Group Name | Purpose |
|------------|---------|
| `AppLocker-Admins` | Full bypass for IT administrators |
| `AppLocker-Installers` | Software deployment permissions |
| `AppLocker-Developers` | Elevated script/app permissions |
| `AppLocker-Standard-Users` | Default restrictions |
| `AppLocker-Audit-Only` | Monitoring mode (no enforcement) |

**Creation:** AD Manager > "Create Groups" button

---

## Event ID Reference

| Event ID | Meaning | Log Location |
|----------|---------|--------------|
| 8001 | Policy applied successfully | EXE and DLL |
| 8002 | Application allowed | EXE and DLL |
| 8003 | Application would be blocked (Audit) | EXE and DLL |
| 8004 | Application blocked (Enforce) | EXE and DLL |
| 8005 | DLL allowed | EXE and DLL |
| 8006 | DLL would be blocked (Audit) | EXE and DLL |
| 8007 | DLL blocked (Enforce) | EXE and DLL |

---

## Known Issues & Infrastructure Requirements

### Requirements

1. **Operating System:** Windows Server 2016+ or Windows 10/11 Pro+
2. **Domain Membership:** Must be domain-joined
3. **Privileges:** Domain Admin for AD/GPO operations
4. **PowerShell Modules:** ActiveDirectory, GroupPolicy
5. **WinRM:** Must be enabled on target machines for remote scanning

### Infrastructure-Dependent Features

| Feature | Requirement | Failure Behavior |
|---------|-------------|------------------|
| Detect Systems | AD module + domain access | Returns empty list |
| WinRM GPO | GroupPolicy module + DA | Shows error |
| Remote Scan | WinRM enabled on targets | Connection timeout |
| Event Monitor | AppLocker configured | Shows no events |
| AD User List | AD module + domain access | Returns empty |
| Group Assignment | AD module + DA | Shows error toast |

### Not Code Bugs

These are **NOT** code bugs but infrastructure requirements:
- "No computers detected" - Need AD access
- "No events found" - Need AppLocker configured
- "No users found" - Need AD access
- "WinRM GPO failed" - Need GroupPolicy module

---

## File Paths (Hardcoded Defaults)

All artifacts saved relative to `C:\AppLocker\`:

```
C:\AppLocker\
├── backups\events\       # Event log backups (.evtx, .xml)
│   └── YYYY-MM\          # Monthly folders
├── compliance\           # NIST evidence packages
├── policies\             # Generated AppLocker XML
│   ├── merged\           # Merged policies
│   ├── templates\        # Rule templates
│   └── ou-based\         # OU-specific policies
└── scans\                # Software inventory JSON/CSV
```

---

## UI Module Reference

### Remote Scan (ScanModule.tsx)
- Detect systems from AD
- Configure scan credentials
- OU-based filtering
- WinRM GPO deployment toggle
- Batch scanning with progress

### Rule Generator (RuleGeneratorModule.tsx)
- Import CSV/JSON artifacts
- Publisher rule creation
- Hash rule fallback for unsigned
- Batch rule generation
- Trusted publisher templates

### Policy Lab (PolicyModule.tsx)
- Policy health checks
- Policy merger tool
- GPO deployment wizard
- Rule validation
- Phase-based deployment (1-4)

### Event Monitor (EventsModule.tsx)
- Real-time event display
- Filter by type (Blocked/Audit/Allowed)
- Search functionality
- CSV export
- EVTX/XML backup

### AD Manager (ADManagementModule.tsx)
- User list with OU filter
- AppLocker group filter
- Checkbox-based group assignment
- Multiple group support
- User profile export

### Compliance (ComplianceModule.tsx)
- NIST 800-53 evidence packages
- Historical report tracking
- Evidence validation

---

## Testing Checklist

### Pre-Test Setup
- [ ] Run on domain-joined Windows Server 2019+
- [ ] Login with Domain Admin account
- [ ] Verify: `Get-Module -ListAvailable ActiveDirectory`
- [ ] Verify: `Get-Module -ListAvailable GroupPolicy`
- [ ] Verify WinRM: `winrm quickconfig`

### Functional Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Detect Systems | Remote Scan > "Detect Systems" | List of AD computers |
| Create Groups | AD Manager > "Create Groups" | 5 groups created in AD |
| Load Users | AD Manager > "Refresh AD" | List of AD users |
| Toggle Group | Select user > Click group checkbox | User added/removed |
| Filter by Group | Select group in dropdown | Filtered user list |
| Load Events | Event Monitor | AppLocker events (if configured) |
| Backup Events | Event Monitor > Backup | EVTX/XML file created |
| Export CSV | Event Monitor > Export | CSV file saved |
| WinRM GPO | Remote Scan > Toggle WinRM | GPO created/modified |

---

## Build & Deployment

```bash
# Development
npm run dev              # Start Vite dev server
npm run electron:dev     # Start Electron with dev server

# Production Build
npm run electron:build:portable

# Output
release/GA-AppLocker Dashboard-1.2.10-x64.exe
```

**Build Requirements:**
- Node.js 18+
- npm 9+
- Windows (for Electron Windows build)

---

## Code Quality Notes

### Error Handling Pattern
All IPC handlers follow this pattern:
```javascript
ipcMain.handle('channel:name', async (event, params) => {
  try {
    // Validate inputs
    // Execute PowerShell or logic
    // Return { success: true, data: ... }
  } catch (error) {
    console.error('[IPC] Handler error:', error);
    return { success: false, error: sanitizeErrorMessage(error) };
  }
});
```

### PowerShell Security
- All user inputs escaped via `escapePowerShellString()`
- Path validation via `isPathAllowed()`
- Module name validation via `isValidModuleName()`

### React Component Pattern
- Functional components with hooks
- `useAsync` for data fetching
- `useMemo` for filtered lists
- `useCallback` for event handlers
- Error boundaries for crash recovery

---

## Contact & Support

For issues, check:
1. PowerShell modules installed
2. Domain admin privileges
3. WinRM enabled on targets
4. AppLocker service running

**Repository:** https://github.com/anthonyscry/GA-AppLockerGUI
