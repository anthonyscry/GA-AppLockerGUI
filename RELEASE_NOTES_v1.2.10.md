# Release Notes v1.2.10

**Release Date:** January 2026
**Branch:** `claude/remove-docker-testing-VYuPw`

---

## Overview

Version 1.2.10 is a **production-ready release** that removes all Docker testing infrastructure, eliminates mock data, and implements real PowerShell-based functionality across all features.

---

## Breaking Changes

### Docker Removal
- Removed entire `docker/` directory (52+ files)
- Removed Docker-related npm scripts
- Removed Docker integration tests
- **Rationale:** Docker was only for local testing; production runs on Windows domain controllers

---

## New Features

### GitHub Actions CI/CD
- Added `.github/workflows/build.yml` for automated Windows builds
- Triggers on push to main, PRs, and version tags
- Produces portable EXE artifacts for each build
- Creates GitHub releases automatically on version tags

### Audit Logging System
- Added `src/infrastructure/logging/AuditLogger.ts`
- Tracks all administrative actions for compliance
- Logs user, action, target, and timestamps
- Supports multiple output formats

### New PowerShell Scripts
| Script | Purpose |
|--------|---------|
| `Enable-WinRMGPO.ps1` | Create/enable WinRM GPO domain-wide |
| `Disable-WinRMGPO.ps1` | Disable/remove WinRM GPO |
| `Export-ComplianceEvidence.ps1` | Full compliance evidence export with manifest |

---

## IPC Handler Overhaul

### Previously Missing Handlers (Now Implemented)
| Handler | Function |
|---------|----------|
| `policy:getInventory` | Queries Windows Registry for installed applications |
| `policy:getTrustedPublishers` | Gets code signing certs from TrustedPublisher store |
| `policy:getGroups` | Gets AppLocker rule collection types |
| `policy:createRule` | Creates Publisher/Path/Hash rules |
| `policy:getPolicyXML` | Fetches real AppLocker policy XML from system |
| `policy:createPathRule` | Creates path-based AppLocker rules |

### AD Handlers (Were Not Registered)
All Active Directory handlers now properly registered and functional:
- `ad:getUsers` - Real `Get-ADUser` queries
- `ad:getUserById` - User lookup by SamAccountName
- `ad:addToGroup` - `Add-ADGroupMember` operations
- `ad:removeFromGroup` - `Remove-ADGroupMember` operations
- `ad:getGroups` - `Get-ADGroup` queries
- `ad:getWinRMGPOStatus` - Check WinRM GPO state
- `ad:toggleWinRMGPO` - Enable/disable WinRM via GPO

### Machine Handlers
- `machine:getAll` - Real `Get-ADComputer` queries
- `machine:getById` - Computer lookup by name
- `machine:startScan` - WinRM-based remote scanning with `Test-WSMan`

### Event Handlers
- `event:getAll` - Real Windows Event Log queries (`Microsoft-Windows-AppLocker/*`)
- `event:getStats` - Computed statistics from real logs
- `event:exportCSV` - Export to CSV via `Export-Csv`

### Compliance Handlers
- `compliance:getEvidenceStatus` - Real file system checks
- `compliance:generateEvidence` - Creates evidence packages
- `compliance:getHistoricalReports` - Reads from compliance directory
- `compliance:validateEvidence` - Validates evidence integrity with SHA256

---

## Mock Data Elimination

### Removed Hardcoded Data
| Location | Before | After |
|----------|--------|-------|
| `PolicyService.getPolicyXMLPreview()` | Hardcoded fake XML | Calls `policy:getPolicyXML` IPC |
| `PolicyModule` health check | Silent mock on failure | Shows error state + alert |
| `Dashboard` trends | Fake "+2 this week" | Data source labels |
| All AD handlers | Returned mock users | Real PowerShell queries |
| All Machine handlers | Returned mock data | Real AD queries |
| All Event handlers | Returned mock events | Real Event Log queries |

---

## UI Improvements

### Removed Non-Functional Elements
- Removed Search button (top right) - was non-functional
- Removed Bell/notification button - was non-functional
- Kept Help button (F1) which works

### Policy Lab Improvements
- Slimmed down header (9 buttons reduced to 4)
- Horizontal phase selector (was vertical, wasted space)
- Compact XML preview section with max-height

### GPO Dialog Fix
- Changed confirmation text from "500+ machines" to "will affect the network"
- More accurate representation for enterprise environments

### User/Domain Detection
- Shows WORKGROUP if not domain-connected
- Detects actual username (was showing "local\user")
- Fixed via real `system:getUserInfo` and `system:getDomainInfo` IPC calls

---

## Technical Details

### Total IPC Handlers: 50

| Category | Count |
|----------|-------|
| Policy | 22 |
| AD | 7 |
| Machine | 3 |
| Event | 3 |
| Compliance | 5 |
| System | 4 |
| Dialog | 3 |
| Events | 1 |
| Utility | 1 |
| FS | 1 |

### Files Changed
- `electron/ipc/ipcHandlers.cjs` - +835 lines of real implementations
- `electron/preload.cjs` - Updated channel whitelist
- `src/application/services/PolicyService.ts` - Real IPC integration
- `components/PolicyModule.tsx` - Error handling improvements
- `components/Dashboard.tsx` - Removed fake trends
- `components/App.tsx` - Removed non-functional buttons
- `scripts/*.ps1` - 3 new PowerShell scripts

---

## Upgrade Notes

### For Existing Users
1. Pull latest from `claude/remove-docker-testing-VYuPw` branch
2. Run `npm install` (no new dependencies)
3. Build with `npm run electron:build:portable`

### Requirements
- Windows 10/11 or Windows Server 2019+
- Domain Controller for full AD functionality
- AppLocker service enabled for policy features
- WinRM enabled for remote scanning

---

## Known Limitations

- Rule templates are still bundled (not fetched from external source)
- Historical trend data requires persistent storage (not implemented)
- Some features require elevation (Run as Administrator)

---

## Commits in This Release

```
fc8a4b5 Deep audit fixes: remove mock data, add missing scripts and handlers
13db4c5 Add missing policy inventory handlers
f8f2c44 Replace all mock data with real PowerShell IPC handlers
f55b61f UI improvements and fixes for production readiness
d1f9317 Fix TypeScript compilation errors
d4337df v1.2.10: Add GitHub Actions CI/CD and audit logging
817d4cf v1.2.10: Remove Docker testing infrastructure
```

---

## Next Steps

1. Merge PR to main branch
2. Tag as `v1.2.10`
3. GitHub Actions will automatically create release with EXE
4. Deploy to production domain controllers
