# GA-AppLocker Dashboard v1.2.10 Release Notes

**Release Date:** January 2026
**Version:** 1.2.10
**Classification:** Production Release

---

## Overview

Version 1.2.10 represents a major architectural improvement focusing on production readiness, security hardening, and infrastructure modernization. This release removes Docker testing infrastructure, adds GitHub Actions CI/CD, and overhauls IPC handlers for real PowerShell execution.

---

## Breaking Changes

### Docker Infrastructure Removed
- **Impact:** Organizations using Docker-based testing environments must migrate to native Windows testing
- **Rationale:** Simplified deployment, reduced attack surface, cleaner codebase
- **Migration:** Use native PowerShell execution on Windows 10/11 or Windows Server 2019/2022

---

## New Features

### 0. Local Scanning & UI Improvements (Latest)
**Added:** January 13, 2026

#### Local Machine Scan
**Handler:** `scan:local` in `electron/ipc/ipcHandlers.cjs`

Enables scanning the local machine without WinRM setup:
- Queries Windows Registry for installed 64-bit applications
- Queries WOW6432Node for 32-bit applications on 64-bit Windows
- Counts executables in Program Files, Program Files (x86), and Windows directories
- Returns app count, exe count, computer name, and timestamp

**Usage:**
```javascript
const result = await electron.ipc.invoke('scan:local', { credentials: { useCurrentUser: true } });
// Returns: { success: true, appCount: 150, exeCount: 5000, computerName: "PC01", scanTime: "..." }
```

#### Machine Selection for Batch Scanning
**Component:** `components/ScanModule.tsx`

- Checkbox selection for individual machines in the scan table
- "Scan Selected (N)" button when machines selected, otherwise "Scan All"
- Toggle select/deselect all machines

#### Event Backup Feature
**Component:** `components/EventsModule.tsx`

- Backup AppLocker events to local storage
- Organized by month folder: `.\backups\events\YYYY-MM\`
- Unique filenames: `hostname-YYYY-MM-DD-HHMMSS.evtx`
- No overwrites - each backup is uniquely timestamped

#### Relative Artifact Paths
All artifacts now save relative to app location for portability:

| Artifact Type | Default Path |
|--------------|--------------|
| Scan Results | `.\scans\` |
| Policies | `.\policies\` |
| Merged Policies | `.\policies\merged\` |
| Templates | `.\policies\templates\` |
| OU-Based Policies | `.\policies\ou-based\` |
| Compliance Evidence | `.\compliance\` |
| Event Backups | `.\backups\events\YYYY-MM\` |

#### UI Fixes
- **GPO Modal:** Changed from absolute to fixed positioning to prevent cutoff
- **Rule Health Score:** Shows "N/A" when no rules configured (not 100/100)
- **Connection Status:** Shows Domain/Host format (domain\hostname or workgroup)
- **Window Size:** Reduced to 1000x700 (min 800x550)
- **Rules Builder:** Converted from modal to inline tab (fixes scrolling)
- **App Icon:** New 4-pointed diamond logo (GA-ASI branding)

### 1. GitHub Actions CI/CD Pipeline
**File:** `.github/workflows/build.yml`

- **Automated Testing:** Jest unit tests run on every push/PR
- **TypeScript Verification:** Compilation checks with `--noEmit`
- **Windows Build:** Portable EXE generation on Windows runner
- **Automated Releases:** Tag-based releases with artifact upload
- **Manual Triggers:** `workflow_dispatch` for on-demand builds

**Workflow Structure:**
```
Test (ubuntu) → Build (windows) → Release (ubuntu, tags only)
```

### 2. Audit Logging Infrastructure
**Files:** `src/infrastructure/logging/AuditLogger.ts`, `src/infrastructure/logging/Logger.ts`

- **22 Security Event Types** across 5 categories:
  - Policy Operations (6): created, modified, deleted, deployed, exported, imported
  - Rule Operations (3): created, modified, deleted
  - AD Operations (4): user added/removed from group, group created/deleted
  - Scan Operations (3): initiated, completed, failed
  - System Operations (6): app started/closed, config changed, export data, credential used, login success/failed

- **Security Features:**
  - Automatic sensitive data redaction (passwords, tokens, API keys)
  - Severity classification (LOW, MEDIUM, HIGH, CRITICAL)
  - CSV export with proper escaping
  - Statistics and success rate tracking
  - 10,000 entry circular buffer

### 3. PowerShell Script Additions
**Directory:** `scripts/`

| Script | Purpose | Lines |
|--------|---------|-------|
| `Enable-WinRMGPO.ps1` | Enable WinRM via Group Policy | 115 |
| `Disable-WinRMGPO.ps1` | Disable/remove WinRM GPO | 93 |
| `Export-ComplianceEvidence.ps1` | Generate compliance evidence packages with SHA256 hashing | 294 |

---

## IPC Handler Overhaul

### Production Handlers (ipcHandlers.cjs)
**Total Handlers:** 50+ fully implemented

#### Policy Handlers (22)
| Handler | Operation | Status |
|---------|-----------|--------|
| `policy:getInventory` | Query registry for installed apps | Real |
| `policy:getTrustedPublishers` | Query certificate store | Real |
| `policy:getGroups` | Get AppLocker rule collections | Real |
| `policy:createRule` | Create Publisher/Path/Hash rule | Real |
| `policy:createPublisherRule` | Create publisher-specific rule | Real |
| `policy:createPathRule` | Create path-based rule | Real |
| `policy:batchCreatePublisherRules` | Batch publisher rules | Real |
| `policy:batchGenerateRules` | Generate rules from inventory | Real |
| `policy:generateFromTemplate` | Template-based generation | Real |
| `policy:generateFromInventory` | Rules from software inventory | Real |
| `policy:generateFromArtifacts` | Rules from scan artifacts | Real |
| `policy:generateBaseline` | Create baseline policy | Real |
| `policy:deploy` | Deploy to GPO with phases | Real |
| `policy:mergePolicies` | Merge multiple XML policies | Real |
| `policy:getIncrementalUpdate` | Delta between policies | Real |
| `policy:importArtifacts` | Convert artifacts to inventory | Real |
| `policy:runHealthCheck` | Health assessment with scoring | Real |
| `policy:validateRules` | Rule syntax validation | Real |
| `policy:groupByPublisher` | Publisher grouping analysis | Real |
| `policy:detectDuplicates` | Duplicate rule detection | Real |
| `policy:getRuleTemplates` | Available rule templates | Real |
| `policy:getPolicyXML` | Get effective/local policy | Real |

#### Compliance Handlers (8)
| Handler | Status |
|---------|--------|
| `compliance:getEvidenceStatus` | Real |
| `compliance:generateEvidence` | Real |
| `compliance:getHistoricalReports` | Real |
| `compliance:validateEvidence` | Real |
| `compliance:generateReport` | Real |
| `compliance:exportEvidence` | Real |
| `compliance:getAuditLogs` | Real |
| `compliance:getComplianceStatus` | Real |

#### Event Handlers (5)
| Handler | Status |
|---------|--------|
| `events:getAll` | Real |
| `events:getStats` | Real |
| `events:collectAuditLogs` | Real |
| `events:exportCSV` | Real |
| `events:getByDateRange` | Real |

#### Machine/Scan Handlers (6)
| Handler | Status |
|---------|--------|
| `machine:getAll` | Real |
| `machine:getById` | Real |
| `machine:startScan` | Real |
| `machine:getScanStatus` | Real |
| `machine:cancelScan` | Real |
| `scan:local` | Real (NEW) |

#### AD Handlers (6)
| Handler | Status |
|---------|--------|
| `ad:getUsers` | Real |
| `ad:searchUsers` | Real |
| `ad:addToGroup` | Real |
| `ad:removeFromGroup` | Real |
| `ad:getGroups` | Real |
| `ad:toggleWinRMGPO` | Real |

#### Dialog Handlers (3)
| Handler | Status |
|---------|--------|
| `dialog:showOpenDialog` | Real |
| `dialog:showSaveDialog` | Real |
| `dialog:showDirectoryDialog` | Real |

---

## Mock Data Elimination

### Removed Mock Data Sources
**File:** `electron/constants.cjs`

| Constant | Purpose | Status |
|----------|---------|--------|
| `MOCK_MACHINES` | Test machine data | Replaced with real queries |
| `MOCK_INVENTORY` | Test software entries | Replaced with registry queries |
| `MOCK_AD_USERS` | Test AD users | Replaced with AD queries |
| `MOCK_EVENTS` | Test AppLocker events | Replaced with event log queries |
| `COMMON_PUBLISHERS` | Publisher definitions | Retained (reference data) |
| `APPLOCKER_GROUPS` | Group names | Retained (reference data) |

---

## Security Improvements

### Input Validation
- Path validation via `isPathAllowed()` function
- Enum validation against whitelists
- PowerShell string escaping via `escapePowerShellString()`
- OU path format validation
- Username/domain validation

### Credential Security
- Passwords passed via environment variables (not command line)
- SecureString conversion for PowerShell
- Credential clearing after use
- No plaintext password logging

### Error Handling
- Global uncaughtException handler
- Global unhandledRejection handler
- Structured error responses
- Error boundary components for React

---

## UI Improvements

### Error Boundaries
- React error boundary with recovery options
- User-friendly error messages
- Development-only error details
- Reload functionality

### Loading States
- Proper loading indicators via `useAsync` hook
- Error state management
- Data/loading/error triplet pattern

### Accessibility
- Basic ARIA support (needs enhancement)
- Keyboard navigation support
- Screen reader compatibility

---

## Known Issues

### Critical (Requires Immediate Attention)
1. **Security:** `policy:getPolicyXML` has unescaped `phase` parameter (PowerShell injection risk)
2. **Security:** 7 path traversal vulnerabilities in IPC handlers missing `isPathAllowed()` validation
3. **TypeScript:** 91 compilation errors due to missing type definitions

### High Priority
1. **Audit Logger:** Implemented but NOT integrated into production handlers
2. **TypeScript Handlers:** Mock implementations not connected to production
3. **E2E Tests:** Playwright configured but not running in CI/CD
4. **Electron:** Version 32.0.0 has known ASAR integrity bypass vulnerability

### Medium Priority
1. **DELETE operations:** No handlers for deleting rules/policies
2. **Test coverage:** `--passWithNoTests` flag masks test failures
3. **Code signing:** Windows EXE is unsigned

---

## Upgrade Notes

### From v1.2.9
1. Remove any Docker-related configurations
2. Update CI/CD to use GitHub Actions
3. Verify PowerShell scripts are accessible
4. Test IPC handlers with real data

### Prerequisites
- Windows 10/11 Enterprise or Windows Server 2019/2022
- PowerShell 5.1+
- AppLocker PowerShell module
- GroupPolicy module (for deployment)
- Node.js 20.x
- Domain Admin rights (for GPO operations)

### Post-Upgrade Verification
```powershell
# Verify scripts
.\scripts\setup.ps1

# Test health check
.\scripts\Test-RuleHealth.ps1

# Verify compliance export
.\scripts\Export-ComplianceEvidence.ps1 -OutputDirectory "C:\Compliance\Test"
```

---

## Dependencies

### Production (6 packages)
- react: 19.2.3
- react-dom: 19.2.3
- react-is: 19.2.3
- lucide-react: 0.562.0
- recharts: 3.6.0
- zod: 3.25.76

### Security Advisory
- **electron:** Update from ^32.0.0 to 35.7.5+ (GHSA-vmqv-hx8q-j7mg)
- **zod:** Consider upgrade to 4.3.5 (major version)

---

## Commit History

| Commit | Description |
|--------|-------------|
| `a9ea44e` | Merge PR #5: Deep audit fixes |
| `fc8a4b5` | Deep audit fixes: remove mock data, add missing scripts |
| `13db4c5` | Add missing policy inventory handlers |
| `f8f2c44` | Replace all mock data with real PowerShell IPC handlers |
| `f55b61f` | UI improvements and fixes for production readiness |
| `d1f9317` | Fix TypeScript compilation errors |
| `d4337df` | v1.2.10: Add GitHub Actions CI/CD and audit logging |
| `817d4cf` | v1.2.10: Remove Docker testing infrastructure |

---

## Contributors

- GA-ASI ISSO Team
- Claude AI (Anthropic)

---

**Document Version:** 1.0
**Last Updated:** January 2026
