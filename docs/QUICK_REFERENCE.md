# GA-ASI AppLocker Quick Reference Guide

**Version:** 1.2.4  
**Author:** GA-ASI ISSO Team

---

## Quick Commands

### Check AppLocker Status
```powershell
# Service status
Get-Service AppIDSvc

# Current policy
Get-AppLockerPolicy -Effective | Format-List

# Export policy
Get-AppLockerPolicy -Effective -Xml | Out-File policy.xml
```

### Test File Against Policy
```powershell
Get-AppLockerPolicy -Effective | 
    Test-AppLockerPolicy -Path "C:\path\to\app.exe" -User "domain\user"
```

### View Recent Events
```powershell
Get-WinEvent -LogName "Microsoft-Windows-AppLocker/EXE and DLL" -MaxEvents 50
```

### Generate Rules from Directory
```powershell
Get-AppLockerFileInformation -Directory "C:\Program Files" -Recurse |
    New-AppLockerPolicy -RuleType Publisher -User Everyone
```

---

## Rule Type Decision Tree

```
Is application signed?
├─ YES → Use Publisher Rule (PREFERRED)
└─ NO → Is it in Program Files/Windows?
    ├─ YES → Use Path Rule (if IT-controlled)
    └─ NO → Use Hash Rule (LAST RESORT)
```

---

## Critical Event IDs

| Event ID | Description | Action |
|----------|-------------|--------|
| 8003 | EXE/DLL would be blocked (Audit) | Review and create allow rule |
| 8004 | EXE/DLL blocked (Enforce) | Create allow rule immediately |
| 8006 | Script would be blocked (Audit) | Review and create allow rule |
| 8007 | Script blocked (Enforce) | Create allow rule immediately |
| 8001 | Policy not applied | **CRITICAL** - Investigate GPO |
| 8000 | Policy applied | OK |

---

## Always-Deny Locations

These paths should ALWAYS have Deny rules:

```
%USERPROFILE%\*
%TEMP%\*
%APPDATA%\*
%LOCALAPPDATA%\*
%WINDIR%\Temp\*
%WINDIR%\Tasks\*
```

---

## Common Publishers

| Publisher | Publisher Name Pattern |
|-----------|----------------------|
| Microsoft | `O=MICROSOFT CORPORATION*` |
| Adobe | `O=ADOBE SYSTEMS INCORPORATED*` |
| Google | `O=GOOGLE LLC*` |
| GA-ASI | `O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.*` |

---

## Health Check Quick Reference

```powershell
# Run health check
.\scripts\Test-RuleHealth.ps1

# Target scores:
# 80-100: HEALTHY
# 60-79:  WARNING
# 40-59:  CRITICAL
# 0-39:   FAILED
```

**Common Issues:**
- **Critical:** Dangerous path rules (user-writable Allow rules)
- **Warning:** Excessive hash rules (>10)
- **Info:** Missing deny rules for bypass prevention

---

## Deployment Checklist

- [ ] Application Identity service running
- [ ] Policy validated (health check >80)
- [ ] Backup of existing policy created
- [ ] GPO exists and is linked to correct OU
- [ ] Test in Audit mode first (14+ days)
- [ ] Review audit logs before enforcement
- [ ] Rollback plan ready

---

## Emergency Rule Creation

**For critical business operations:**

1. Create rule immediately:
   ```powershell
   New-GAAppLockerPublisherRule -PublisherName "..." -RuleName "Emergency-Rule"
   ```

2. Deploy to affected OU:
   ```powershell
   .\Deploy-AppLockerPolicy.ps1 -PolicyPath "emergency.xml" -GPOName "AppLocker-WS-Standard-Policy"
   ```

3. Document after the fact
4. Review within 24 hours
5. Convert to permanent rule if needed

---

## STIG Compliance Quick Check

```powershell
# Check for default rules (STIG violation)
Get-AppLockerPolicy -Effective -Xml | Select-Xml -XPath "//*Rule[@Name='(Default Rule) All files']"

# Should return: $null (no default rules)
```

**Required STIG Controls:**
- ✅ V-220708: AppLocker configured
- ✅ V-220709: Default rules removed
- ✅ V-220710: Audit or Enforce mode

---

## Troubleshooting Quick Fixes

### Policy Not Applying
```powershell
# 1. Check service
Get-Service AppIDSvc

# 2. Force GPO update
gpupdate /force

# 3. Check GPO application
gpresult /h report.html

# 4. Review Event ID 8001 errors
Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-AppLocker/EXE and DLL"; Id=8001}
```

### Application Blocked
```powershell
# 1. Check event log
Get-WinEvent -LogName "Microsoft-Windows-AppLocker/EXE and DLL" -MaxEvents 10

# 2. Get file signature
Get-AuthenticodeSignature "C:\path\to\app.exe"

# 3. Test against policy
Get-AppLockerPolicy -Effective | Test-AppLockerPolicy -Path "C:\path\to\app.exe"
```

### Performance Issues
- Disable DLL rules (if enabled)
- Convert hash rules to publisher rules
- Simplify path rules
- Consolidate redundant rules

---

## Contact Information

- **ISSO Team:** isso@ga-asi.com
- **IT Service Desk:** servicedesk@ga-asi.com
- **Emergency:** [Internal escalation process]

---

**Last Updated:** 2024
