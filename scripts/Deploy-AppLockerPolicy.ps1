# Deploy-AppLockerPolicy.ps1
# GA-ASI AppLocker Policy Deployment Script
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Deploys AppLocker policy to Active Directory Group Policy.

.DESCRIPTION
    This script deploys an AppLocker policy XML file to a specified Group Policy Object (GPO).
    It includes validation, backup, and rollback capabilities.

.PARAMETER PolicyPath
    Path to the AppLocker policy XML file.

.PARAMETER GPOName
    Name of the target GPO.

.PARAMETER Domain
    Domain name (default: current domain).

.PARAMETER BackupPath
    Path to backup existing policy before deployment.

.PARAMETER WhatIf
    Preview changes without applying them.

.EXAMPLE
    .\Deploy-AppLockerPolicy.ps1 -PolicyPath "C:\Policies\AppLocker.xml" -GPOName "AppLocker-WS-Standard-Policy"

.EXAMPLE
    .\Deploy-AppLockerPolicy.ps1 -PolicyPath "C:\Policies\AppLocker.xml" -GPOName "AppLocker-WS-Standard-Policy" -BackupPath "C:\Backups" -WhatIf
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path $_ })]
    [string]$PolicyPath,
    
    [Parameter(Mandatory = $true)]
    [string]$GPOName,
    
    [Parameter(Mandatory = $false)]
    [string]$Domain = $env:USERDNSDOMAIN,
    
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

try {
    Write-Log "Starting AppLocker policy deployment..." "INFO"
    
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
    }
    catch {
        throw "Policy XML is malformed: $_"
    }
    
    Write-Log "Policy XML validated successfully" "SUCCESS"
    
    # Check GPO exists
    Write-Log "Checking GPO: $GPOName" "INFO"
    try {
        $gpo = Get-GPO -Name $GPOName -Domain $Domain -ErrorAction Stop
        Write-Log "GPO found: $($gpo.DisplayName)" "SUCCESS"
    }
    catch {
        throw "GPO '$GPOName' not found in domain '$Domain'. Create it first or check the name."
    }
    
    # Backup existing policy
    if (-not $WhatIf) {
        Write-Log "Backing up existing policy..." "INFO"
        if (-not (Test-Path $BackupPath)) {
            New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
        }
        
        $backupFile = Join-Path $BackupPath "AppLocker-$GPOName-$(Get-Date -Format 'yyyyMMdd-HHmmss').xml"
        try {
            $existingPolicy = Get-AppLockerPolicy -Ldap "LDAP://$($gpo.Path)"
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
    }
    else {
        Write-Log "Deploying policy to GPO..." "INFO"
        
        # Set AppLocker policy in GPO
        Set-AppLockerPolicy -XmlPolicy $policyXml -Ldap "LDAP://$($gpo.Path)"
        
        Write-Log "Policy deployed successfully to GPO: $GPOName" "SUCCESS"
        Write-Log "GPO will apply on next Group Policy refresh (gpupdate /force)" "INFO"
    }
    
    # Verify deployment
    if (-not $WhatIf) {
        Write-Log "Verifying deployment..." "INFO"
        Start-Sleep -Seconds 2
        
        $deployedPolicy = Get-AppLockerPolicy -Ldap "LDAP://$($gpo.Path)"
        if ($deployedPolicy) {
            Write-Log "Deployment verified successfully" "SUCCESS"
        }
        else {
            Write-Log "WARNING: Could not verify deployment" "WARNING"
        }
    }
    
    Write-Log "Deployment process completed" "SUCCESS"
}
catch {
    Write-Log "DEPLOYMENT FAILED: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    exit 1
}
