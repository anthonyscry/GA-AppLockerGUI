# Automatic Rule Generation from Scan Data

This guide explains how GA-AppLocker GUI automatically generates AppLocker rules from ingested scan data, including file types, priority hierarchy, best practices for writable paths, and group assignments.

## Overview

The rule generation system processes scan artifacts (JSON format) and creates AppLocker rules following a strict priority hierarchy to ensure both security and maintainability.

## Rule Type Priority Hierarchy

Rules are generated in this priority order:

### Priority 1: Publisher Rules (Preferred)

Publisher rules are the **most resilient** option because they:
- Survive application updates (version changes don't break the rule)
- Are based on the digital certificate used to sign the executable
- Provide broad coverage while maintaining security

**How it works:**
```powershell
$sig = Get-AuthenticodeSignature -FilePath $FilePath
if ($sig.Status -eq 'Valid') {
    # Extract publisher from certificate subject: O=Microsoft Corporation
    $publisherName = $sig.SignerCertificate.Subject
}
```

**Best for:**
- Enterprise software with valid code signing
- Microsoft applications
- Vendor-provided applications

### Priority 2: Hash Rules (Fallback)

Hash rules are used when Publisher rules cannot be created (unsigned executables):
- Most specific identification using SHA256 hash
- Break when file is modified in any way (updates, patches)
- Require rule regeneration after each update

**How it works:**
```powershell
$hash = (Get-FileHash -Path $FilePath -Algorithm SHA256).Hash
```

**Best for:**
- Custom internal applications without code signing
- Legacy unsigned software
- Scripts and batch files

### Priority 3: Path Rules (Avoided)

Path rules are **intentionally avoided** in automatic generation because:
- Easily bypassed by copying executables to allowed paths
- Break when installation location changes
- Create security vulnerabilities in user-writable locations

**Only use manually for:**
- Temporary exceptions during migration
- Controlled directories with strict ACLs

## Supported File Types (Collection Types)

| Collection Type | File Extensions | Description |
|-----------------|-----------------|-------------|
| **Exe** | .exe, .com | Executable files |
| **Msi** | .msi, .msp | Windows Installer packages |
| **Script** | .ps1, .bat, .cmd, .vbs, .js | Script files |
| **Dll** | .dll, .ocx | Dynamic libraries |
| **Appx** | .appx, .msix | Packaged apps |

## Artifact Sources for Rule Generation

The system ingests artifacts from multiple sources:

### 1. Executables Array
Direct scan results from software inventory:
```json
{
  "Executables": [
    {
      "Path": "C:\\Program Files\\App\\app.exe",
      "Name": "app.exe",
      "Publisher": "O=Vendor Corp",
      "Hash": "ABC123..."
    }
  ]
}
```

### 2. Writable Paths Array
User-writable locations flagged during security scans:
```json
{
  "WritablePaths": [
    {
      "Path": "C:\\Users\\Public\\Downloads\\tool.exe",
      "Name": "tool.exe",
      "Hash": "DEF456..."
    }
  ]
}
```

### 3. Event Logs
Extracted from AppLocker audit events:
```json
{
  "EventLogs": [
    {
      "Path": "C:\\Windows\\Temp\\blocked.exe",
      "EventId": 8003
    }
  ]
}
```

## AppLocker Groups and Their Purpose

Rules are assigned to groups based on user roles:

| Group | Purpose | Typical Rules |
|-------|---------|---------------|
| **AppLocker-Admins** | Full system access | Allow all signed software |
| **AppLocker-Installers** | Software deployment | Allow MSI packages, installers |
| **AppLocker-Developers** | Development tools | Allow IDEs, compilers, debuggers |
| **AppLocker-Standard-Users** | Regular employees | Allow approved business apps only |
| **AppLocker-Audit-Only** | Testing/monitoring | Audit mode only, no blocking |

### Group Assignment Best Practices

1. **Standard Users** - Most restrictive; only allow approved business applications
2. **Developers** - Allow development tools but deny execution from writable paths
3. **Installers** - Allow MSI execution, require elevation for system changes
4. **Admins** - Broader access but still deny known-malicious patterns
5. **Audit-Only** - Use during initial deployment to identify blocking issues

## Writable Path Security Best Practices

### High-Risk Paths to Monitor

These paths are user-writable and commonly exploited:

| Path | Risk Level | Recommendation |
|------|------------|----------------|
| `C:\Users\*\AppData\Local\Temp` | **Critical** | Block execution, allow only signed |
| `C:\Users\*\Downloads` | **Critical** | Block execution entirely |
| `C:\Users\Public` | **High** | Block execution |
| `C:\Windows\Temp` | **High** | Block for non-admins |
| `C:\ProgramData` | **Medium** | Monitor, allow signed only |

### Deny Rules for Writable Paths

Create explicit DENY rules for user-writable locations:

```xml
<FilePathRule Id="..." Name="Block User Downloads" Action="Deny">
  <Conditions>
    <FilePathCondition Path="%OSDRIVE%\Users\*\Downloads\*"/>
  </Conditions>
</FilePathRule>
```

### Exception Handling

When legitimate software requires execution from writable paths:

1. **Prefer Publisher rules** - If signed, create Publisher rule instead of Path
2. **Use Hash rules** - For specific known-good unsigned files
3. **Never allow wildcard paths** - `C:\Users\*\AppData\*` is too broad
4. **Document exceptions** - Track why each exception exists

## Rule Generation Process Flow

```
┌─────────────────┐
│  Scan Artifacts │
│    (JSON)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deduplication  │
│  (by file path) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  For Each Executable:       │
│                             │
│  1. Try Publisher Rule      │
│     ├─ Success → Add Rule   │
│     └─ Fail    ↓            │
│                             │
│  2. Try Hash Rule           │
│     ├─ Success → Add Rule   │
│     └─ Fail → Skip Item     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────┐
│  Merge Rules    │
│  into Policy    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Export XML     │
│  Policy File    │
└─────────────────┘
```

## Usage Examples

### Generate Rules from Scan Artifacts

```powershell
.\Generate-RulesFromArtifacts.ps1 `
    -ArtifactsPath "C:\Scans\inventory.json" `
    -OutputPath "C:\Policies\Generated.xml" `
    -CollectionType "Exe"
```

### Merge with Existing Policy

```powershell
.\Generate-RulesFromArtifacts.ps1 `
    -ArtifactsPath "C:\Scans\inventory.json" `
    -OutputPath "C:\Policies\Merged.xml" `
    -MergeWithExisting `
    -ExistingPolicyPath "C:\Policies\Current.xml"
```

### Batch Generation via UI

1. Navigate to **Policy > Generate Rules**
2. Select scan items from the **Scanned Items** tab
3. Choose **Rule Type**: Publisher (recommended) or Hash
4. Select **Target Group**: e.g., AppLocker-Standard-Users
5. Click **Generate Batch Rules**

## Statistics and Reporting

After generation, the system reports:

| Metric | Description |
|--------|-------------|
| Publisher Rules | Count of rules based on digital signatures |
| Hash Rules | Count of fallback hash-based rules |
| Skipped | Items that couldn't be processed (file not found) |
| Errors | Processing errors encountered |
| Duplicates | Removed duplicate entries |

Example output:
```
=== GENERATION STATISTICS ===
Total artifact references: 150
Unique executables: 127
Publisher rules: 98 (Preferred)
Hash rules: 22 (Fallback)
Skipped: 7
Errors: 0
Total rules generated: 120
```

## Security Validation

All generated rules undergo validation:

1. **Input sanitization** - XML escaping to prevent injection
2. **Path validation** - Only allowed base paths accepted
3. **Enum validation** - Enforcement modes and rule types verified
4. **Control character filtering** - No hidden characters allowed

## Enforcement Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **AuditOnly** | Log events but don't block | Initial deployment, testing |
| **Enabled** | Actively enforce rules | Production environment |
| **NotConfigured** | Collection disabled | Specific collections only |

## Recommended Deployment Strategy

1. **Scan** - Run comprehensive scans on reference machines
2. **Generate** - Create rules in AuditOnly mode
3. **Test** - Deploy to pilot group, monitor events
4. **Refine** - Address blocked legitimate applications
5. **Enable** - Switch to Enabled mode incrementally
6. **Monitor** - Continuously review audit logs

---

*For additional information, see the [GA-ASI AppLocker Implementation Guide](./GA-ASI_APPLOCKER_IMPLEMENTATION_GUIDE.md).*
