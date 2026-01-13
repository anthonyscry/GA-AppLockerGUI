# GA-ASI AppLocker Enterprise Implementation Guide

**Version:** 1.0  
**Author:** GA-ASI ISSO Team  
**Date:** 2024  
**Classification:** Internal Use Only

---

## Executive Summary

This guide provides a comprehensive, enterprise-grade AppLocker implementation strategy specifically tailored for General Atomics Aeronautical Systems, Inc. (GA-ASI) environments. It addresses DoD STIG compliance, defense-in-depth security, and operational maintainability for both classified and unclassified networks.

---

## 1. GA-ASI ENVIRONMENT ASSESSMENT

### 1.1 Infrastructure Discovery Checklist

#### Windows Environment
- [ ] Windows version inventory (Windows 10/11 Enterprise, Windows Server 2019/2022)
- [ ] Domain vs. workgroup mapping
- [ ] Active Directory forest/domain structure
- [ ] Group Policy infrastructure health
- [ ] OU structure for AppLocker policy targeting

#### Network Segmentation
- [ ] Classified network (air-gapped) identification
- [ ] Unclassified network zones
- [ ] DMZ and perimeter systems
- [ ] Trust boundaries and domain relationships
- [ ] Cross-domain authentication paths

#### User & Privilege Assessment
- [ ] Standard user accounts inventory
- [ ] Local administrator accounts (document exceptions)
- [ ] Domain admin accounts (minimize per STIG)
- [ ] Service accounts (managed vs. interactive)
- [ ] Developer workstations (separate OU recommended)
- [ ] Kiosk/public access systems
- [ ] Flight test and engineering systems

#### Existing Security Controls
- [ ] Antivirus/EDR solution (integration points)
- [ ] SIEM platform (Splunk, Sentinel, etc.)
- [ ] Windows Event Forwarding (WEF) configuration
- [ ] Patch management (WSUS, SCCM, Intune)
- [ ] Software deployment mechanisms
- [ ] Code signing infrastructure (GA-ASI certificates)

### 1.2 GA-ASI Application Inventory

#### Line of Business Applications
- [ ] Flight simulation software
- [ ] CAD/engineering tools (SolidWorks, CATIA, etc.)
- [ ] Configuration management systems
- [ ] Test equipment control software
- [ ] Manufacturing execution systems
- [ ] Quality assurance tools

#### Microsoft 365 / Office
- [ ] Office version (2016/2019/365)
- [ ] Office update channels
- [ ] Click-to-Run vs. MSI installation
- [ ] OneDrive sync client
- [ ] Teams desktop client

#### Development Tools
- [ ] Visual Studio (versions)
- [ ] .NET SDK versions
- [ ] Python installations
- [ ] Git clients
- [ ] Compilers and build tools
- [ ] Debugging tools

#### Administrative Tools
- [ ] RSAT (Remote Server Administration Tools)
- [ ] Sysinternals Suite
- [ ] Network monitoring tools
- [ ] Backup software
- [ ] Remote access tools (RDP, VNC)

#### Scripts & Automation
- [ ] PowerShell scripts (signed vs. unsigned)
- [ ] Batch files for automation
- [ ] Python scripts
- [ ] VBScript/JavaScript
- [ ] Scheduled task scripts

#### Portable Applications
- [ ] USB-deployed tools
- [ ] Portable executables
- [ ] Temporary installer locations

### 1.3 GA-ASI Compliance Requirements

#### DoD STIG Alignment
- **Windows 10 STIG:**
  - V-220708: AppLocker must be configured
  - V-220709: AppLocker default rules must be removed/modified
  - V-220710: AppLocker must be in Audit or Enforce mode

- **Windows Server 2019/2022 STIG:**
  - V-205672: AppLocker must be configured
  - V-205673: AppLocker default rules must be removed/modified

#### NIST 800-53 Controls
- AC-3: Access Enforcement
- AC-7: Unsuccessful Logon Attempts
- CM-7: Least Functionality
- SI-3: Malicious Code Protection

#### Additional GA-ASI Requirements
- [ ] CORA (Cybersecurity Operations Risk Assessment) evidence collection
- [ ] Audit trail for policy changes
- [ ] Change management process integration
- [ ] Incident response integration

---

## 2. APPLOCKER RULE STRATEGY FOR GA-ASI

### 2.1 Rule Type Priority (GA-ASI Standard)

1. **Publisher Rules** (PREFERRED - 80%+ of rules)
   - Use for all Microsoft products
   - Use for major vendors (Adobe, Cisco, VMware, etc.)
   - Use for GA-ASI code-signed applications
   - Survives updates automatically

2. **Path Rules** (LIMITED USE - 15% of rules)
   - Only for IT-controlled, non-user-writable locations:
     - `C:\Windows\*`
     - `C:\Program Files\*`
     - `C:\Program Files (x86)\*`
     - Network shares with restricted write access
   - **NEVER** for user-writable paths

3. **Hash Rules** (MINIMUM USE - 5% of rules)
   - Legacy unsigned applications only
   - Temporary exceptions during migration
   - Specific version locks (document justification)

### 2.2 GA-ASI Rule Collections

#### Executable Rules (.exe, .com)
**Priority:** HIGHEST - Deploy first

**Baseline Rules:**
- Allow: Microsoft Windows (Publisher)
- Allow: Program Files (Path)
- Allow: Program Files (x86) (Path)
- Allow: Windows Directory (Path)
- Deny: All user-writable locations (see bypass prevention)

**GA-ASI Specific:**
- Allow: GA-ASI code-signed applications (Publisher)
- Allow: Engineering tools (Publisher/Path as appropriate)
- Allow: Flight test software (Publisher/Path)

#### Script Rules (.ps1, .bat, .cmd, .vbs, .js)
**Priority:** HIGH - Deploy in Phase 2

**Baseline Rules:**
- Allow: Microsoft signed scripts (Publisher)
- Allow: GA-ASI signed scripts (Publisher)
- Allow: IT-controlled script share (Path: `\\server\scripts$\*`)
- Deny: All user-writable script locations

**PowerShell Constrained Language Mode:**
- Automatically enabled when script rules are enforced
- Verify: `$ExecutionContext.SessionState.LanguageMode`
- Admin accounts get FullLanguage (by design)

#### Windows Installer Rules (.msi, .msp, .mst)
**Priority:** MEDIUM - Deploy in Phase 3

**Baseline Rules:**
- Allow: Microsoft signed installers (Publisher)
- Allow: Managed installer (SCCM/Intune) - if configured
- Allow: IT distribution points (Path)
- Deny: User-writable installer locations

#### Packaged App Rules (APPX)
**Priority:** LOW - Deploy as needed

- Windows Store applications
- UWP applications
- Separate from desktop application rules

#### DLL Rules (.dll, .ocx)
**Priority:** CRITICAL - Phase 4 only after extensive testing

**⚠️ WARNING:** Significant performance impact. Only enable after:
- 14+ days of audit mode
- Performance baseline established
- All legitimate DLLs identified
- Executive approval obtained

---

## 3. GA-ASI IMPLEMENTATION PHASES

### Phase 1: EXE Rules - Audit Mode
**Duration:** 2-4 weeks minimum  
**Target:** All workstations and servers

**Steps:**
1. Deploy AppLocker EXE rules in Audit Only mode
2. Configure Windows Event Forwarding for Event ID 8003
3. Aggregate logs via SIEM (Splunk/Sentinel)
4. Generate baseline application inventory
5. Document all legitimate applications
6. Identify exceptions and justifications

**Success Criteria:**
- Event log collection operational
- Zero production disruptions
- Complete application inventory
- Exception requests documented

### Phase 2: EXE + Script Rules - Audit Mode
**Duration:** 2-3 weeks  
**Prerequisite:** Phase 1 complete

**Steps:**
1. Add Script rule collection in Audit Only mode
2. Monitor Event ID 8006 (would-be-blocked scripts)
3. Identify legitimate script execution patterns
4. Create publisher rules for signed scripts
5. Document unsigned script requirements

**Success Criteria:**
- Script execution patterns documented
- PowerShell Constrained Language Mode verified
- No legitimate automation broken

### Phase 3: EXE + Script + MSI Rules - Audit Mode
**Duration:** 2-3 weeks  
**Prerequisite:** Phase 2 complete

**Steps:**
1. Add MSI rule collection in Audit Only mode
2. Monitor Event ID 8023 (would-be-blocked installers)
3. Configure managed installer (if using SCCM)
4. Document software installation patterns

**Success Criteria:**
- Installation patterns documented
- Managed installer configured (if applicable)
- IT deployment processes validated

### Phase 4: Full Enforcement (EXE + Script + MSI)
**Duration:** Staged rollout over 4-8 weeks  
**Prerequisite:** 14+ days audit data for all phases

**Rollout Strategy:**
1. **Week 1:** IT staff pilot (10-20 users)
2. **Week 2:** Early adopters (50-100 users)
3. **Week 3-4:** Department-by-department (Engineering, Operations, etc.)
4. **Week 5-8:** Full enterprise deployment

**Rollback Plan:**
- GPO with Audit-only ready for immediate revert
- Escalation path: ISSO team
- Emergency rule creation process (< 2 hours SLA)

### Phase 5: DLL Rules (OPTIONAL - High Security Only)
**Duration:** 6+ months planning and testing  
**Prerequisite:** Phases 1-4 stable for 90+ days

**⚠️ CRITICAL CONSIDERATIONS:**
- Significant performance impact (10-30% slower application launch)
- Requires extensive baseline testing
- Only for air-gapped/high-security environments
- Executive approval required

---

## 4. GA-ASI BASELINE RULE SET

### 4.1 Executable Rules Template

```xml
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    
    <!-- ALLOW: Microsoft Windows System Files -->
    <FilePublisherRule Id="72277d33-..." Name="Microsoft-Windows-System" Action="Allow" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePublisherCondition PublisherName="O=MICROSOFT CORPORATION*" 
                                ProductName="*" 
                                BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*"/>
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>
    
    <!-- ALLOW: Program Files (IT-controlled) -->
    <FilePathRule Id="a1b2c3d4-..." Name="Program-Files" Action="Allow" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%PROGRAMFILES%\*"/>
      </Conditions>
    </FilePathRule>
    
    <FilePathRule Id="e5f6g7h8-..." Name="Program-Files-x86" Action="Allow" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%PROGRAMFILES(X86)%\*"/>
      </Conditions>
    </FilePathRule>
    
    <!-- ALLOW: Windows Directory -->
    <FilePathRule Id="i9j0k1l2-..." Name="Windows-Directory" Action="Allow" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%WINDIR%\*"/>
      </Conditions>
    </FilePathRule>
    
    <!-- ALLOW: GA-ASI Code-Signed Applications -->
    <FilePublisherRule Id="ga-asi-001" Name="GA-ASI-Signed-Apps" Action="Allow" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePublisherCondition PublisherName="O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.*" 
                                ProductName="*" 
                                BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*"/>
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>
    
    <!-- DENY: User-Writable Locations (Bypass Prevention) -->
    <FilePathRule Id="deny-001" Name="Block-User-Profiles" Action="Deny" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%USERPROFILE%\*"/>
      </Conditions>
    </FilePathRule>
    
    <FilePathRule Id="deny-002" Name="Block-Temp" Action="Deny" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%TEMP%\*"/>
      </Conditions>
    </FilePathRule>
    
    <FilePathRule Id="deny-003" Name="Block-AppData" Action="Deny" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%APPDATA%\*"/>
      </Conditions>
    </FilePathRule>
    
    <FilePathRule Id="deny-004" Name="Block-LocalAppData" Action="Deny" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%LOCALAPPDATA%\*"/>
      </Conditions>
    </FilePathRule>
    
    <!-- DENY: System Writable Locations -->
    <FilePathRule Id="deny-005" Name="Block-Windows-Temp" Action="Deny" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%WINDIR%\Temp\*"/>
      </Conditions>
    </FilePathRule>
    
    <FilePathRule Id="deny-006" Name="Block-Windows-Tasks" Action="Deny" UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%WINDIR%\Tasks\*"/>
      </Conditions>
    </FilePathRule>
    
  </RuleCollection>
</AppLockerPolicy>
```

### 4.2 Script Rules Template

```xml
<RuleCollection Type="Script" EnforcementMode="AuditOnly">
  
  <!-- ALLOW: Microsoft Signed Scripts -->
  <FilePublisherRule Id="script-001" Name="Microsoft-Signed-Scripts" Action="Allow" UserOrGroupSid="S-1-1-0">
    <Conditions>
      <FilePublisherCondition PublisherName="O=MICROSOFT CORPORATION*" 
                              ProductName="*" 
                              BinaryName="*">
        <BinaryVersionRange LowSection="*" HighSection="*"/>
      </FilePublisherCondition>
    </Conditions>
  </FilePublisherRule>
  
  <!-- ALLOW: GA-ASI Signed Scripts -->
  <FilePublisherRule Id="script-002" Name="GA-ASI-Signed-Scripts" Action="Allow" UserOrGroupSid="S-1-1-0">
    <Conditions>
      <FilePublisherCondition PublisherName="O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.*" 
                              ProductName="*" 
                              BinaryName="*">
        <BinaryVersionRange LowSection="*" HighSection="*"/>
      </FilePublisherCondition>
    </Conditions>
  </FilePublisherRule>
  
  <!-- ALLOW: IT Scripts Share -->
  <FilePathRule Id="script-003" Name="IT-Scripts-Share" Action="Allow" UserOrGroupSid="S-1-1-0">
    <Conditions>
      <FilePathCondition Path="\\ga-asi-scripts\scripts$\*"/>
    </Conditions>
  </FilePathRule>
  
  <!-- DENY: User-Writable Script Locations -->
  <FilePathRule Id="script-deny-001" Name="Block-User-Scripts" Action="Deny" UserOrGroupSid="S-1-1-0">
    <Conditions>
      <FilePathCondition Path="%USERPROFILE%\*"/>
    </Conditions>
  </FilePathRule>
  
</RuleCollection>
```

---

## 5. CRITICAL BYPASS PREVENTION FOR GA-ASI

### 5.1 Always-Deny Locations

**User Profile Locations:**
```
%USERPROFILE%\*
%APPDATA%\*
%LOCALAPPDATA%\*
%TEMP%\*
C:\Users\*\AppData\*
C:\Users\*\Desktop\*
C:\Users\*\Downloads\*
```

**System Writable Locations:**
```
%WINDIR%\Temp\*
%WINDIR%\Tasks\*
%WINDIR%\Debug\*
%WINDIR%\Tracing\*
%WINDIR%\System32\Tasks\*
%WINDIR%\SysWOW64\Tasks\*
```

### 5.2 LOLBin (Living Off the Land) Controls

**High-Risk Binaries to Monitor/Restrict:**
- `mshta.exe` - HTML Application Host
- `wscript.exe` / `cscript.exe` - Windows Script Host
- `regsvr32.exe` - COM registration
- `rundll32.exe` - DLL execution
- `msiexec.exe` - Windows Installer
- `certutil.exe` - Certificate utility (often abused for downloads)
- `bitsadmin.exe` - BITS transfers
- `powershell.exe` / `pwsh.exe` - PowerShell (use Constrained Language Mode)
- `cmd.exe` - Command prompt

**GA-ASI Mitigation:**
1. Publisher rules limiting to Microsoft-signed only
2. Monitoring/alerting on execution (SIEM integration)
3. PowerShell Constrained Language Mode (automatic with script rules)
4. Consider blocking `certutil.exe` and `bitsadmin.exe` for standard users

---

## 6. GA-ASI SPECIAL SCENARIOS

### 6.1 Developer Workstations

**Challenge:** Developers need to run compiled/test code

**GA-ASI Solution:**
1. Separate OU: `OU=Developer-Workstations,OU=Workstations,DC=ga-asi,DC=local`
2. Separate GPO with relaxed AppLocker policy
3. Path rules for designated development directories:
   - `C:\Dev\Projects\*` (IT-controlled)
   - `C:\Build\Output\*` (IT-controlled)
4. Code signing requirement for all dev-created executables
5. Publisher rules for development tools only (Visual Studio, etc.)

**NEVER:** Allow blanket execution from user profiles for developers

### 6.2 Engineering/CAD Workstations

**Challenge:** Engineering tools may have complex dependencies

**GA-ASI Solution:**
1. Publisher rules for major vendors (Autodesk, Dassault, etc.)
2. Path rules for engineering tool directories (IT-controlled)
3. Document all engineering tool dependencies
4. Test thoroughly in audit mode before enforcement

### 6.3 Flight Test Systems

**Challenge:** Specialized software, potential air-gapped networks

**GA-ASI Solution:**
1. Separate AppLocker policy for flight test OU
2. Hash rules for specialized flight test software (if unsigned)
3. Document all flight test software with business justification
4. Air-gapped systems: Consider Phase 4 (DLL rules) for maximum security

### 6.4 Software Updates & Patching

**Challenge:** Updates break hash rules, installers need temp access

**GA-ASI Solution:**
1. Publisher rules (updates maintain signature) - PREFERRED
2. Managed installer rules (SCCM/MEMCM as trusted installer)
3. Path rules for IT-controlled update staging locations
4. Coordinate patch windows with AppLocker policy updates

### 6.5 Legacy Applications

**Challenge:** Unsigned, ancient applications

**GA-ASI Solution:**
1. Hash rules (requires update on every change) - TEMPORARY
2. Repackage and sign with GA-ASI certificate - PREFERRED
3. Application virtualization (App-V) - if available
4. Path rule to dedicated legacy app folder (IT-controlled)
5. Sunset planning - migrate to modern alternatives

---

## 7. GROUP POLICY CONFIGURATION FOR GA-ASI

### 7.1 Recommended GPO Structure

```
Domain: ga-asi.local
├── Domain Controllers
│   └── GPO: AppLocker-DC-Policy (separate, minimal rules)
├── Servers
│   ├── Application Servers
│   │   └── GPO: AppLocker-SRV-App-Policy
│   ├── File Servers
│   │   └── GPO: AppLocker-SRV-File-Policy
│   └── Database Servers
│       └── GPO: AppLocker-SRV-DB-Policy
├── Workstations
│   ├── Standard Users
│   │   └── GPO: AppLocker-WS-Standard-Policy (strictest)
│   ├── Power Users
│   │   └── GPO: AppLocker-WS-Power-Policy (slightly relaxed)
│   ├── Developers
│   │   └── GPO: AppLocker-WS-Dev-Policy (dev-specific)
│   ├── Engineering
│   │   └── GPO: AppLocker-WS-Engineering-Policy
│   └── Kiosks
│       └── GPO: AppLocker-WS-Kiosk-Policy (most restrictive)
├── Admin Workstations (PAW)
│   └── GPO: AppLocker-WS-PAW-Policy
└── Quarantine
    └── GPO: AppLocker-Audit-Only (for troubleshooting)
```

### 7.2 GPO Settings Path

```
Computer Configuration
└── Policies
    └── Windows Settings
        └── Security Settings
            └── Application Control Policies
                └── AppLocker
                    ├── Executable Rules
                    ├── Windows Installer Rules
                    ├── Script Rules
                    ├── Packaged App Rules
                    └── DLL Rules (Phase 4 only)
```

### 7.3 Application Identity Service

**MUST be running on all systems:**

```powershell
# GPO Configuration:
Computer Configuration
└── Policies
    └── Windows Settings
        └── Security Settings
            └── System Services
                └── Application Identity
                    └── Startup Mode: Automatic

# Verification:
Get-Service AppIDSvc | Select Status, StartType
```

---

## 8. MONITORING & ALERTING FOR GA-ASI

### 8.1 Event Log Configuration

**Log Location:**
```
Applications and Services Logs\Microsoft\Windows\AppLocker
```

**Event Channels:**
- EXE and DLL: `Microsoft-Windows-AppLocker/EXE and DLL`
- MSI and Script: `Microsoft-Windows-AppLocker/MSI and Script`
- Packaged App: `Microsoft-Windows-AppLocker/Packaged app-Deployment`
- Packaged App Execution: `Microsoft-Windows-AppLocker/Packaged app-Execution`

**Increase Log Size (default 1MB insufficient):**
```powershell
wevtutil sl "Microsoft-Windows-AppLocker/EXE and DLL" /ms:52428800
wevtutil sl "Microsoft-Windows-AppLocker/MSI and Script" /ms:52428800
```

### 8.2 Critical Event IDs

**BLOCKED EVENTS (Enforce Mode):**
- **8004:** EXE/DLL blocked
- **8007:** Script blocked
- **8022:** MSI blocked
- **8025:** Packaged app blocked

**AUDIT EVENTS (Would-be-blocked):**
- **8003:** EXE/DLL would be blocked
- **8006:** Script would be blocked
- **8021:** MSI would be blocked
- **8024:** Packaged app would be blocked

**ALLOWED EVENTS:**
- **8002:** EXE/DLL allowed
- **8005:** Script allowed
- **8020:** MSI allowed

**ERROR EVENTS:**
- **8000:** AppLocker policy applied
- **8001:** AppLocker policy not applied (ERROR - investigate!)

### 8.3 SIEM Integration (Splunk/Sentinel)

**High-Priority Searches:**

```spl
# Blocked executions (immediate attention)
index=windows EventCode IN (8004, 8007, 8022) 
| stats count by host, user, FilePath, RuleName
| sort -count

# Audit mode violations (pre-enforcement visibility)
index=windows EventCode IN (8003, 8006, 8021)
| stats count by FilePath, Publisher, Hash
| sort -count

# Policy application failures (critical)
index=windows EventCode=8001
| alert

# Anomaly detection: New blocked paths
index=windows EventCode IN (8003, 8004, 8006, 8007)
| rare FilePath

# User attempting multiple blocked apps (possible malicious activity)
index=windows EventCode IN (8004, 8007) 
| stats dc(FilePath) as unique_blocked count by user
| where unique_blocked > 5
```

---

## 9. TROUBLESHOOTING FRAMEWORK

### 9.1 Common Issues & Resolution

#### Application Blocked Unexpectedly
1. Check event log for specific block event (Event ID 8004/8007/8022)
2. Identify rule that blocked (or lack of allow rule)
3. Verify file signature: `Get-AuthenticodeSignature <file>`
4. Determine appropriate rule type:
   - Signed? → Publisher rule
   - Unsigned? → Hash or Path rule
5. Test rule in audit mode first
6. Deploy via GPO

#### Policy Not Applying
1. Verify Application Identity service running
2. Check GPO application: `gpresult /h gpreport.html`
3. Verify OU membership
4. Check for conflicting policies
5. Run: `gpupdate /force`
6. Review Event ID 8001 errors

#### Performance Issues
**Symptoms:** Slow application launch, high CPU

**Causes:**
1. DLL rules enabled (significant overhead)
2. Excessive hash rules
3. Complex path rules with many exceptions

**Solutions:**
1. Disable DLL rules unless required
2. Convert hash rules to publisher rules
3. Simplify path rules
4. Consolidate redundant rules

### 9.2 Diagnostic Commands

```powershell
# Get current AppLocker policy
Get-AppLockerPolicy -Effective | Format-List

# Export policy to XML
Get-AppLockerPolicy -Effective -Xml | Out-File C:\policy.xml

# Test if file would be allowed
Get-AppLockerPolicy -Effective | 
    Test-AppLockerPolicy -Path "C:\path\to\app.exe" -User "ga-asi\user"

# Get file publisher info
Get-AppLockerFileInformation -Path "C:\path\to\app.exe"

# Generate rules from installed software
Get-AppLockerFileInformation -Directory "C:\Program Files" -Recurse |
    New-AppLockerPolicy -RuleType Publisher -User Everyone

# Check Application Identity service
Get-Service AppIDSvc

# View recent AppLocker events
Get-WinEvent -LogName "Microsoft-Windows-AppLocker/EXE and DLL" -MaxEvents 50
```

---

## 10. COMPLIANCE & DOCUMENTATION

### 10.1 STIG Alignment

**Windows 10 STIG:**
- V-220708: AppLocker must be configured ✅
- V-220709: AppLocker default rules must be removed/modified ✅
- V-220710: AppLocker must be in Audit or Enforce mode ✅

**Windows Server 2019/2022 STIG:**
- V-205672: AppLocker must be configured ✅
- V-205673: AppLocker default rules must be removed/modified ✅

### 10.2 Rule Documentation Template

For each rule, document:

```
Rule Name: [Descriptive name]
Rule Type: Publisher / Hash / Path
Action: Allow / Deny
Applies To: User group or SID
Collection: Exe / Script / MSI / DLL / Packaged

Business Justification:
[Why this application/path is needed]

Application Details:
- Name: 
- Vendor:
- Version:
- Publisher cert:
- File hash (if applicable):

Risk Assessment:
- Risk without rule: [Low/Medium/High]
- Compensating controls:

Approval:
- Requested by:
- Approved by: [ISSO Team]
- Date:
- Review date:

Change History:
- [Date]: [Change description]
```

### 10.3 Regular Review Checklist

**Monthly:**
- [ ] Review blocked event logs
- [ ] Process pending exception requests
- [ ] Update hash rules for patched applications
- [ ] Verify Application Identity service health

**Quarterly:**
- [ ] Full policy audit
- [ ] Remove rules for decommissioned applications
- [ ] Review admin exception usage
- [ ] Test policy in lab environment
- [ ] Update documentation

**Annually:**
- [ ] Complete application inventory refresh
- [ ] Re-baseline with audit mode
- [ ] Review against updated STIGs
- [ ] Penetration test AppLocker controls
- [ ] Update bypass prevention rules

### 10.4 CORA Evidence Collection

**Required Evidence:**
1. AppLocker policy XML exports (quarterly)
2. Event log samples (monthly)
3. Policy change documentation
4. Exception request approvals
5. Health check reports
6. Compliance audit reports

**Automation:**
- Use GA-AppLocker Dashboard Compliance module
- Generate evidence packages automatically
- Archive with retention policy

---

## 11. GA-ASI OPERATIONAL RUNBOOKS

### 11.1 Exception Request Process

1. **User submits request** via IT Service Desk
2. **Initial assessment:**
   - Is application legitimate?
   - Can it be signed with GA-ASI certificate?
   - Is there an alternative?
3. **If approved:**
   - Create appropriate rule (Publisher preferred)
   - Test in audit mode
   - Deploy via GPO
   - Document in rule database
4. **SLA:** 2 business days for standard requests, 4 hours for critical

### 11.2 Emergency Rule Creation

**For critical business operations:**

1. Create rule immediately (Publisher or Hash)
2. Deploy to affected OU via GPO
3. Document after the fact
4. Review within 24 hours
5. Convert to permanent rule if needed

### 11.3 Incident Response for Bypasses

1. **Detection:** SIEM alert or user report
2. **Investigation:**
   - Review event logs
   - Identify bypass method
   - Assess impact
3. **Containment:**
   - Add deny rule if needed
   - Block user account if malicious
   - Isolate affected systems
4. **Remediation:**
   - Update AppLocker policy
   - Patch system if vulnerability exploited
   - Update documentation
5. **Lessons Learned:**
   - Document bypass method
   - Update training materials
   - Improve detection rules

---

## 12. SUCCESS METRICS

### 12.1 Key Performance Indicators (KPIs)

- **Policy Coverage:** % of systems with AppLocker enabled
- **Rule Health Score:** Based on health check (target: >80)
- **Exception Rate:** New exceptions per month (target: <5% of user base)
- **Block Rate:** Legitimate applications blocked (target: <1%)
- **Response Time:** Average time to resolve exception requests (target: <2 days)
- **Compliance:** STIG compliance score (target: 100%)

### 12.2 Reporting

**Monthly Reports:**
- Policy health summary
- Exception requests and approvals
- Blocked application trends
- Compliance status

**Quarterly Reports:**
- Full policy audit results
- Rule effectiveness analysis
- Security incident summary
- Recommendations for improvement

---

## APPENDIX A: GA-ASI CONTACTS

- **ISSO Team:** isso@ga-asi.com
- **IT Service Desk:** servicedesk@ga-asi.com
- **Security Operations:** soc@ga-asi.com

---

## APPENDIX B: REFERENCES

- [Microsoft AppLocker Documentation](https://docs.microsoft.com/en-us/windows/security/threat-protection/windows-defender-application-control/applocker/applocker-overview)
- [DoD STIGs](https://public.cyber.mil/stigs/)
- [NIST 800-53](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- GA-ASI Security Policy Documents (Internal)

---

**Document Control:**
- **Version:** 1.0
- **Last Updated:** 2024
- **Next Review:** Quarterly
- **Owner:** GA-ASI ISSO Team
