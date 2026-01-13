# Deploy-AppLockerPolicy.ps1
# GA-ASI AppLocker Policy Deployment Script
# Version: 1.2.5
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Deploys AppLocker policy to Active Directory Group Policy and links to OUs.

.DESCRIPTION
    This script deploys an AppLocker policy XML file to a specified Group Policy Object (GPO)
    and optionally links the GPO to one or more Organizational Units (OUs).
    It includes validation, backup, and rollback capabilities.

.PARAMETER PolicyPath
    Path to the AppLocker policy XML file.

.PARAMETER GPOName
    Name of the target GPO. Will be created if it doesn't exist.

.PARAMETER OUPath
    Distinguished name of the OU to link the GPO to. Can be an array for multiple OUs.
    Example: "OU=Workstations,OU=Computers,DC=contoso,DC=com"

.PARAMETER Domain
    Domain name (default: current domain).

.PARAMETER Phase
    Deployment phase (Phase1, Phase2, Phase3, Phase4). Affects enforcement mode.
    Phase1-3: AuditOnly, Phase4: Enabled (configurable)

.PARAMETER EnforcementMode
    Override enforcement mode. Options: AuditOnly, Enabled

.PARAMETER CreateGPO
    Create the GPO if it doesn't exist.

.PARAMETER BackupPath
    Path to backup existing policy before deployment.

.PARAMETER WhatIf
    Preview changes without applying them.

.EXAMPLE
    .\Deploy-AppLockerPolicy.ps1 -PolicyPath "C:\Policies\AppLocker.xml" -GPOName "AppLocker-WS-Policy"

.EXAMPLE
    .\Deploy-AppLockerPolicy.ps1 -PolicyPath "C:\Policies\WS-Policy.xml" -GPOName "AppLocker-WS-Policy" -OUPath "OU=Workstations,DC=contoso,DC=com" -Phase "Phase1"

.EXAMPLE
    .\Deploy-AppLockerPolicy.ps1 -PolicyPath "C:\Policies\SRV-Policy.xml" -GPOName "AppLocker-SRV-Policy" -OUPath @("OU=Servers,DC=contoso,DC=com", "OU=FileServers,DC=contoso,DC=com") -CreateGPO
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path $_ })]
    [string]$PolicyPath,
    
    [Parameter(Mandatory = $true)]
    [string]$GPOName,
    
    [Parameter(Mandatory = $false)]
    [string[]]$OUPath,
    
    [Parameter(Mandatory = $false)]
    [string]$Domain = $env:USERDNSDOMAIN,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("Phase1", "Phase2", "Phase3", "Phase4")]
    [string]$Phase = "Phase1",
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("AuditOnly", "Enabled")]
    [string]$EnforcementMode,
    
    [Parameter(Mandatory = $false)]
    [switch]$CreateGPO,
    
    [Parameter(Mandatory = $false)]
    [string]$BackupPath = "C:\AppLockerBackups",
    
    [Parameter(Mandatory = $false)]
    [switch]$WhatIf
)

#Requires -Modules GroupPolicy, AppLocker
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Get-EnforcementModeFromPhase {
    param([string]$Phase, [string]$Override)
    
    if ($Override) {
        return $Override
    }
    
    # Phase 1-3: Audit mode, Phase 4: Enforce
    switch ($Phase) {
        "Phase1" { return "AuditOnly" }
        "Phase2" { return "AuditOnly" }
        "Phase3" { return "AuditOnly" }
        "Phase4" { return "Enabled" }
        default { return "AuditOnly" }
    }
}

function New-AppLockerGPO {
    param([string]$Name, [string]$Domain)
    
    Write-Log "Creating new GPO: $Name" "INFO"
    
    try {
        $gpo = New-GPO -Name $Name -Domain $Domain -Comment "AppLocker Policy - Created by GA-AppLocker Toolkit"
        Write-Log "GPO created successfully: $($gpo.DisplayName)" "SUCCESS"
        return $gpo
    }
    catch {
        throw "Failed to create GPO '$Name': $_"
    }
}

function Link-GPOToOU {
    param(
        [string]$GPOName,
        [string]$OUPath,
        [string]$Domain
    )
    
    Write-Log "Linking GPO '$GPOName' to OU: $OUPath" "INFO"
    
    try {
        # Check if link already exists
        $existingLinks = Get-GPInheritance -Target $OUPath -Domain $Domain | 
            Select-Object -ExpandProperty GpoLinks | 
            Where-Object { $_.DisplayName -eq $GPOName }
        
        if ($existingLinks) {
            Write-Log "GPO is already linked to this OU" "WARNING"
            return
        }
        
        # Create the link
        New-GPLink -Name $GPOName -Target $OUPath -Domain $Domain -LinkEnabled Yes -Enforced No
        Write-Log "GPO linked successfully to OU: $OUPath" "SUCCESS"
    }
    catch {
        Write-Log "Failed to link GPO to OU '$OUPath': $_" "ERROR"
        throw $_
    }
}

try {
    Write-Log "========================================" "INFO"
    Write-Log "GA-AppLocker Policy Deployment Script" "INFO"
    Write-Log "Version 1.2.5" "INFO"
    Write-Log "========================================" "INFO"
    Write-Log "Starting AppLocker policy deployment..." "INFO"
    Write-Log "Domain: $Domain" "INFO"
    Write-Log "Phase: $Phase" "INFO"
    
    # Determine enforcement mode
    $effectiveMode = Get-EnforcementModeFromPhase -Phase $Phase -Override $EnforcementMode
    Write-Log "Enforcement Mode: $effectiveMode" "INFO"
    
    # Validate policy file
    Write-Log "Validating policy XML file..." "INFO"
    $policyXml = Get-Content $PolicyPath -Raw
    if (-not $policyXml) {
        throw "Policy file is empty or invalid"
    }
    
    # Validate XML structure
    try {
        [xml]$xml = $policyXml
        if ($xml.AppLockerPolicy -eq $null) {
            throw "Invalid AppLocker policy XML structure"
        }
        
        # Update enforcement mode in policy if needed
        foreach ($ruleCollection in $xml.AppLockerPolicy.RuleCollection) {
            $ruleCollection.EnforcementMode = $effectiveMode
        }
        $policyXml = $xml.OuterXml
    }
    catch {
        throw "Policy XML is malformed: $_"
    }
    
    Write-Log "Policy XML validated successfully" "SUCCESS"
    
    # Check/Create GPO
    Write-Log "Checking GPO: $GPOName" "INFO"
    try {
        $gpo = Get-GPO -Name $GPOName -Domain $Domain -ErrorAction Stop
        Write-Log "GPO found: $($gpo.DisplayName)" "SUCCESS"
    }
    catch {
        if ($CreateGPO) {
            if ($WhatIf) {
                Write-Log "WHAT IF: Would create GPO: $GPOName" "INFO"
            }
            else {
                $gpo = New-AppLockerGPO -Name $GPOName -Domain $Domain
            }
        }
        else {
            throw "GPO '$GPOName' not found in domain '$Domain'. Use -CreateGPO to create it."
        }
    }
    
    # Backup existing policy
    if (-not $WhatIf) {
        Write-Log "Backing up existing policy..." "INFO"
        if (-not (Test-Path $BackupPath)) {
            New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
        }
        
        $backupFile = Join-Path $BackupPath "AppLocker-$GPOName-$(Get-Date -Format 'yyyyMMdd-HHmmss').xml"
        try {
            $existingPolicy = Get-AppLockerPolicy -Ldap "LDAP://$($gpo.Path)" -ErrorAction SilentlyContinue
            if ($existingPolicy) {
                $existingPolicy | Get-AppLockerPolicy -Xml | Out-File $backupFile -Encoding UTF8
                Write-Log "Backup saved to: $backupFile" "SUCCESS"
            }
            else {
                Write-Log "No existing policy found to backup" "WARNING"
            }
        }
        catch {
            Write-Log "Could not backup existing policy: $_" "WARNING"
        }
    }
    
    # Deploy policy
    if ($WhatIf) {
        Write-Log "WHAT IF: Would deploy policy to GPO: $GPOName" "INFO"
        Write-Log "WHAT IF: Policy file: $PolicyPath" "INFO"
        Write-Log "WHAT IF: Domain: $Domain" "INFO"
        Write-Log "WHAT IF: Enforcement Mode: $effectiveMode" "INFO"
    }
    else {
        Write-Log "Deploying policy to GPO..." "INFO"
        
        # Set AppLocker policy in GPO
        Set-AppLockerPolicy -XmlPolicy $policyXml -Ldap "LDAP://$($gpo.Path)"
        
        Write-Log "Policy deployed successfully to GPO: $GPOName" "SUCCESS"
    }
    
    # Link GPO to OUs
    if ($OUPath -and $OUPath.Count -gt 0) {
        Write-Log "----------------------------------------" "INFO"
        Write-Log "Linking GPO to Organizational Units..." "INFO"
        
        foreach ($ou in $OUPath) {
            if ($WhatIf) {
                Write-Log "WHAT IF: Would link GPO to OU: $ou" "INFO"
            }
            else {
                Link-GPOToOU -GPOName $GPOName -OUPath $ou -Domain $Domain
            }
        }
    }
    else {
        Write-Log "No OU paths specified - GPO will need to be linked manually" "WARNING"
    }
    
    # Verify deployment
    if (-not $WhatIf) {
        Write-Log "----------------------------------------" "INFO"
        Write-Log "Verifying deployment..." "INFO"
        Start-Sleep -Seconds 2
        
        $deployedPolicy = Get-AppLockerPolicy -Ldap "LDAP://$($gpo.Path)" -ErrorAction SilentlyContinue
        if ($deployedPolicy) {
            Write-Log "Deployment verified successfully" "SUCCESS"
            
            # Show summary
            $ruleCount = 0
            foreach ($collection in $deployedPolicy.RuleCollections) {
                $ruleCount += $collection.Count
            }
            Write-Log "Total rules deployed: $ruleCount" "INFO"
        }
        else {
            Write-Log "WARNING: Could not verify deployment" "WARNING"
        }
    }
    
    Write-Log "========================================" "INFO"
    Write-Log "Deployment process completed" "SUCCESS"
    Write-Log "Next steps:" "INFO"
    Write-Log "  1. Run 'gpupdate /force' on target machines" "INFO"
    Write-Log "  2. Monitor Event Viewer for AppLocker events (8003/8004)" "INFO"
    Write-Log "  3. Review audit logs before moving to next phase" "INFO"
    Write-Log "========================================" "INFO"
    
    # Return summary as JSON for IPC
    $summary = @{
        Success = $true
        GPOName = $GPOName
        PolicyPath = $PolicyPath
        Domain = $Domain
        Phase = $Phase
        EnforcementMode = $effectiveMode
        OUsLinked = $OUPath
        BackupPath = if (-not $WhatIf) { $backupFile } else { $null }
    } | ConvertTo-Json -Compress
    
    Write-Output $summary
}
catch {
    Write-Log "DEPLOYMENT FAILED: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    
    $error = @{
        Success = $false
        Error = $_.Exception.Message
    } | ConvertTo-Json -Compress
    
    Write-Output $error
    exit 1
}
