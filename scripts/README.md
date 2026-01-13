# GA-AppLocker PowerShell Scripts

**Version:** 1.2.10
**Author:** GA-ASI ISSO Team

This directory contains PowerShell scripts and modules for comprehensive AppLocker policy management in GA-ASI environments.

---

## Prerequisites

- Windows 10/11 Enterprise or Windows Server 2019/2022
- PowerShell 5.1 or later
- AppLocker PowerShell module (included with Windows)
- Group Policy module (for deployment scripts)
- Appropriate permissions:
  - Local Admin for policy operations
  - Domain Admin for GPO deployment

### Quick Setup

Run the setup script to verify your environment:

```powershell
.\setup.ps1
```

For automatic module installation (if supported):

```powershell
.\setup.ps1 -InstallModules
```

---

## Module: GA-AppLocker.psm1

Core PowerShell module providing AppLocker rule generation and management functions.

### Installation

```powershell
# Import the module
Import-Module .\GA-AppLocker.psm1 -Force

# Verify module loaded
Get-Module GA-AppLocker
```

### Functions

#### New-GAAppLockerPublisherRule
Creates a Publisher rule based on digital signature.

```powershell
New-GAAppLockerPublisherRule `
    -PublisherName "O=MICROSOFT CORPORATION*" `
    -RuleName "Microsoft-Windows" `
    -CollectionType Exe
```

#### New-GAAppLockerPathRule
Creates a Path rule for file system locations.

```powershell
New-GAAppLockerPathRule `
    -Path "%PROGRAMFILES%\*" `
    -RuleName "Program-Files" `
    -CollectionType Exe
```

#### New-GAAppLockerHashRule
Creates a Hash rule for specific file versions.

```powershell
New-GAAppLockerHashRule `
    -FilePath "C:\LegacyApp\app.exe" `
    -RuleName "Legacy-App" `
    -CollectionType Exe
```

#### New-GAAppLockerBaselinePolicy
Generates a complete baseline policy for GA-ASI.

```powershell
New-GAAppLockerBaselinePolicy `
    -EnforcementMode AuditOnly `
    -OutputPath "C:\Policies\Baseline.xml"
```

#### Get-GAAppLockerPolicyHealth
Performs health check on AppLocker policy.

```powershell
Get-GAAppLockerPolicyHealth -PolicyPath "C:\Policies\AppLocker.xml"
```

#### Export-GAAppLockerPolicy
Exports policy to XML file.

```powershell
Export-GAAppLockerPolicy -OutputPath "C:\Policies\Export.xml"
```

---

## Scripts

### 1. Deploy-AppLockerPolicy.ps1

Deploys AppLocker policy to Active Directory Group Policy Object.

**Usage:**
```powershell
.\Deploy-AppLockerPolicy.ps1 `
    -PolicyPath "C:\Policies\AppLocker.xml" `
    -GPOName "AppLocker-WS-Standard-Policy" `
    -BackupPath "C:\Backups"
```

**Parameters:**
- `-PolicyPath` (Required): Path to policy XML file
- `-GPOName` (Required): Target GPO name
- `-Domain` (Optional): Domain name (default: current domain)
- `-BackupPath` (Optional): Backup directory (default: C:\AppLockerBackups)
- `-WhatIf` (Switch): Preview changes without applying

**Features:**
- Validates policy XML structure
- Backs up existing policy automatically
- Verifies GPO exists before deployment
- Confirms deployment success

---

### 2. Test-RuleHealth.ps1

Comprehensive health check for AppLocker policy.

**Usage:**
```powershell
.\Test-RuleHealth.ps1 `
    -PolicyPath "C:\Policies\AppLocker.xml" `
    -OutputPath "C:\Reports\HealthCheck.json"
```

**Parameters:**
- `-PolicyPath` (Optional): Policy XML path (uses effective policy if not specified)
- `-OutputPath` (Optional): JSON report output path

**Checks:**
- Application Identity service status
- Hash rule count (maintenance burden)
- Dangerous path rules (user-writable locations)
- Bypass prevention rules
- Default rules (STIG violation)
- Enforcement mode

**Output:**
- Health score (0-100)
- Critical/Warning/Info findings
- Detailed recommendations
- JSON report (if specified)

---

### 3. Get-AppLockerAuditLogs.ps1

Collects and analyzes AppLocker audit event logs.

**Usage:**
```powershell
.\Get-AppLockerAuditLogs.ps1 `
    -ComputerName "WS-001", "WS-002" `
    -StartTime (Get-Date).AddDays(-7) `
    -OutputPath "C:\Logs\Audit.csv" `
    -ExportToSIEM
```

**Parameters:**
- `-ComputerName` (Optional): Target computers (default: localhost)
- `-StartTime` (Optional): Start time (default: 24 hours ago)
- `-EndTime` (Optional): End time (default: now)
- `-EventID` (Optional): Event IDs to collect (default: 8003, 8004, 8006, 8007)
- `-OutputPath` (Optional): CSV output path
- `-ExportToSIEM` (Switch): Export in SIEM format

**Event IDs:**
- **8003:** EXE/DLL would be blocked (Audit)
- **8004:** EXE/DLL blocked (Enforce)
- **8006:** Script would be blocked (Audit)
- **8007:** Script blocked (Enforce)
- **8021:** MSI would be blocked (Audit)
- **8022:** MSI blocked (Enforce)

**Output:**
- Event summary by Event ID
- Top computers by event count
- Top blocked/attempted files
- CSV export
- SIEM-formatted export (optional)

---

### 4. New-RulesFromInventory.ps1

Generates AppLocker rules from software inventory scan results.

**Usage:**
```powershell
.\New-RulesFromInventory.ps1 `
    -InventoryPath "C:\Scans\inventory.csv" `
    -OutputPath "C:\Policies\Generated.xml" `
    -RuleType Auto `
    -MergeWithExisting `
    -ExistingPolicyPath "C:\Policies\Baseline.xml"
```

**Parameters:**
- `-InventoryPath` (Required): Inventory CSV or JSON file
- `-OutputPath` (Required): Output policy XML path
- `-RuleType` (Optional): Auto, Publisher, Path, or Hash (default: Auto)
- `-CollectionType` (Optional): Exe, Script, MSI, or DLL (default: Exe)
- `-MergeWithExisting` (Switch): Merge with existing policy
- `-ExistingPolicyPath` (Optional): Existing policy to merge with

**Inventory File Format (CSV):**
See `templates/inventory-template.csv` for example format.

```csv
Name,Path,Publisher,Version,Type
"Microsoft Word","C:\Program Files\Microsoft Office\WINWORD.EXE","O=MICROSOFT CORPORATION*","16.0","EXE"
```

**Rule Generation Logic:**
1. **Auto mode:** Tries Publisher first, then Path, then Hash
2. **Publisher:** Uses digital signature if available
3. **Path:** Uses for Program Files/Windows locations
4. **Hash:** Fallback for unsigned applications

---

### 5. Get-ComplianceReport.ps1

Generates comprehensive compliance reports.

**Usage:**
```powershell
.\Get-ComplianceReport.ps1 `
    -OutputDirectory "C:\Compliance\Reports" `
    -ReportFormat All `
    -IncludeEvidence
```

**Parameters:**
- `-PolicyPath` (Optional): Policy XML path (uses effective policy if not specified)
- `-OutputDirectory` (Required): Output directory for reports
- `-ReportFormat` (Optional): HTML, PDF, JSON, or All (default: All)
- `-IncludeEvidence` (Switch): Include evidence files

**Report Contents:**
- Executive summary with health score
- STIG compliance status (V-220708, V-220709, V-220710)
- Policy health metrics
- Rule statistics by collection
- Recommendations
- Evidence files (policy exports, event logs)

**Output Files:**
- `ComplianceReport-YYYYMMDD-HHMMSS.html` - HTML report
- `ComplianceReport-YYYYMMDD-HHMMSS.json` - JSON data
- `PolicyExport-YYYYMMDD-HHMMSS.xml` - Policy export (if -IncludeEvidence)
- `EventLogs-YYYYMMDD-HHMMSS.csv` - Event logs (if -IncludeEvidence)

---

### 6. setup.ps1

Environment setup and prerequisite verification.

**Usage:**
```powershell
.\setup.ps1
.\setup.ps1 -InstallModules
```

**Checks:**
- PowerShell version (requires 5.1+)
- AppLocker module availability
- GroupPolicy module availability
- Application Identity service status
- Administrator rights
- GA-AppLocker module import

---

### 7. Enable-WinRMGPO.ps1

Enables WinRM (Windows Remote Management) via Group Policy for remote AppLocker management.

**Usage:**
```powershell
.\Enable-WinRMGPO.ps1 `
    -GPOName "WinRM-Enable-Policy" `
    -TargetOU "OU=Workstations,DC=contoso,DC=com"
```

**Parameters:**
- `-GPOName` (Optional): Name of GPO to create (default: "WinRM-Enable-Policy")
- `-TargetOU` (Optional): Target OU for GPO linking

**Features:**
- Creates GPO with WinRM service configuration
- Configures IPv4/IPv6 filters
- Links GPO to specified OU
- Returns JSON status for IPC integration

**Security Note:** Opens WinRM to all addresses by default. Ensure firewall rules restrict access to trusted networks.

---

### 8. Disable-WinRMGPO.ps1

Disables or removes WinRM Group Policy configuration.

**Usage:**
```powershell
# Disable only (keeps GPO)
.\Disable-WinRMGPO.ps1 -GPOName "WinRM-Enable-Policy"

# Complete removal
.\Disable-WinRMGPO.ps1 -GPOName "WinRM-Enable-Policy" -RemoveGPO
```

**Parameters:**
- `-GPOName` (Optional): Name of GPO to disable (default: "WinRM-Enable-Policy")
- `-RemoveGPO` (Switch): Completely remove GPO instead of just disabling

**Features:**
- Disables GPO settings without deletion (default)
- Option to completely remove GPO and all links
- Safe cleanup of OU links before deletion
- Returns JSON status for IPC integration

---

### 9. Export-ComplianceEvidence.ps1

Generates comprehensive compliance evidence packages for auditors with integrity verification.

**Usage:**
```powershell
.\Export-ComplianceEvidence.ps1 `
    -OutputDirectory "C:\Compliance\Q1-2026" `
    -DaysBack 30 `
    -IncludeSystemInfo
```

**Parameters:**
- `-OutputDirectory` (Required): Output directory for evidence package
- `-DaysBack` (Optional): Number of days of audit logs to include (default: 30)
- `-IncludeSystemInfo` (Switch): Include system configuration snapshot

**Output Structure:**
```
OutputDirectory/
├── Evidence_YYYYMMDD_HHMMSS/
│   ├── policies/
│   │   └── AppLockerPolicy_Export.xml
│   ├── logs/
│   │   └── AuditEvents_30Days.csv
│   ├── system/
│   │   └── SystemInfo.json
│   └── manifest.json (SHA256 hashes)
```

**Features:**
- Exports current AppLocker policies
- Collects audit event logs (configurable date range)
- Captures system configuration snapshot
- Generates SHA256 hashes for all files
- Creates manifest for evidence chain of custody
- Individual error handling per section (resilient operation)

**Compliance Use Cases:**
- STIG compliance audits
- Security assessments
- Change management documentation
- Incident response evidence collection

---

## Templates

### inventory-template.csv
Example inventory CSV file format for use with `New-RulesFromInventory.ps1`.

### baseline-policy-template.xml
Example baseline policy XML template (for reference only - use `New-GAAppLockerBaselinePolicy` to generate actual policies).

---

## Common Workflows

### Initial Policy Deployment

```powershell
# 1. Setup environment
.\setup.ps1

# 2. Generate baseline policy
New-GAAppLockerBaselinePolicy -EnforcementMode AuditOnly -OutputPath "C:\Policies\Baseline.xml"

# 3. Run health check
.\Test-RuleHealth.ps1 -PolicyPath "C:\Policies\Baseline.xml"

# 4. Deploy to GPO (after validation)
.\Deploy-AppLockerPolicy.ps1 `
    -PolicyPath "C:\Policies\Baseline.xml" `
    -GPOName "AppLocker-WS-Standard-Policy"
```

### Adding Rules from Inventory

```powershell
# 1. Generate rules from inventory
.\New-RulesFromInventory.ps1 `
    -InventoryPath "C:\Scans\inventory.csv" `
    -OutputPath "C:\Policies\NewRules.xml" `
    -RuleType Auto

# 2. Merge with existing policy
.\New-RulesFromInventory.ps1 `
    -InventoryPath "C:\Scans\inventory.csv" `
    -OutputPath "C:\Policies\Merged.xml" `
    -MergeWithExisting `
    -ExistingPolicyPath "C:\Policies\Baseline.xml"

# 3. Test health
.\Test-RuleHealth.ps1 -PolicyPath "C:\Policies\Merged.xml"

# 4. Deploy
.\Deploy-AppLockerPolicy.ps1 `
    -PolicyPath "C:\Policies\Merged.xml" `
    -GPOName "AppLocker-WS-Standard-Policy"
```

### Audit Mode Analysis

```powershell
# 1. Collect audit logs
.\Get-AppLockerAuditLogs.ps1 `
    -StartTime (Get-Date).AddDays(-14) `
    -OutputPath "C:\Logs\Audit-14Days.csv" `
    -ExportToSIEM

# 2. Analyze results (review CSV)
# 3. Generate rules for blocked applications
# 4. Update policy
# 5. Re-deploy
```

### Compliance Reporting

```powershell
# Generate quarterly compliance report
.\Get-ComplianceReport.ps1 `
    -OutputDirectory "C:\Compliance\Q1-2024" `
    -ReportFormat All `
    -IncludeEvidence
```

---

## Troubleshooting

### Module Not Found
```powershell
# Ensure module is in the same directory or in PSModulePath
$env:PSModulePath -split ';'
Import-Module .\GA-AppLocker.psm1 -Force
```

### Permission Errors
- Ensure running as Administrator
- For GPO deployment, Domain Admin rights required
- Application Identity service must be running

### Policy Not Applying
```powershell
# Check Application Identity service
Get-Service AppIDSvc

# Verify GPO application
gpresult /h gpreport.html

# Force policy update
gpupdate /force
```

### Health Check Failures
- Review critical findings in health check output
- Address dangerous path rules immediately
- Convert excessive hash rules to publisher rules
- Ensure bypass prevention rules are in place

---

## Integration with GA-AppLocker Dashboard

These scripts are designed to integrate with the GA-AppLocker Dashboard GUI:

- **Policy Lab Module:** Uses `New-GAAppLockerBaselinePolicy` and rule generation functions
- **Health Check:** Uses `Test-RuleHealth.ps1` for policy validation
- **Event Monitor:** Uses `Get-AppLockerAuditLogs.ps1` for log collection
- **Compliance Module:** Uses `Get-ComplianceReport.ps1` for report generation

The Electron app uses IPC handlers (see `electron/ipc/`) to execute these scripts securely.

---

## Support

For issues or questions:
- **ISSO Team:** isso@ga-asi.com
- **IT Service Desk:** servicedesk@ga-asi.com

---

## Version History

- **1.2.10** (2026): WinRM GPO management and compliance evidence
  - Added Enable-WinRMGPO.ps1 for remote management setup
  - Added Disable-WinRMGPO.ps1 for GPO cleanup
  - Added Export-ComplianceEvidence.ps1 for audit packages
  - SHA256 hash verification for evidence integrity
  - JSON output for IPC integration

- **1.2.4** (2024): Initial release
  - Core module functions
  - Deployment scripts
  - Health check and compliance reporting
  - Audit log collection
  - Environment setup script

---

**Document Control:**
- **Version:** 1.2.10
- **Last Updated:** January 2026
- **Owner:** GA-ASI ISSO Team
