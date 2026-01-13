# Setup-GAAppLockerEnvironment.ps1
# GA-ASI AppLocker Environment Setup Script
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Sets up the GA-AppLocker environment and verifies prerequisites.

.DESCRIPTION
    This script checks for required PowerShell modules, verifies AppLocker
    functionality, and ensures the environment is ready for policy management.

.PARAMETER InstallModules
    Automatically install required modules if missing (may require admin).

.EXAMPLE
    .\setup.ps1

.EXAMPLE
    .\setup.ps1 -InstallModules
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [switch]$InstallModules
)

$ErrorActionPreference = "Continue"

function Write-Status {
    param(
        [string]$Message,
        [string]$Status = "INFO"
    )
    
    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        default { "Cyan" }
    }
    
    $symbol = switch ($Status) {
        "SUCCESS" { "✓" }
        "WARNING" { "⚠" }
        "ERROR" { "✗" }
        default { "•" }
    }
    
    Write-Host "[$symbol] $Message" -ForegroundColor $color
}

Write-Status "GA-AppLocker Environment Setup" "INFO"
Write-Status "Version: 1.2.4" "INFO"
Write-Status ""

$checks = @{
    PowerShellVersion = $false
    AppLockerModule = $false
    GroupPolicyModule = $false
    ApplicationIdentityService = $false
    AdminRights = $false
}

# Check PowerShell version
Write-Status "Checking PowerShell version..." "INFO"
if ($PSVersionTable.PSVersion.Major -ge 5) {
    Write-Status "PowerShell $($PSVersionTable.PSVersion) - OK" "SUCCESS"
    $checks.PowerShellVersion = $true
} else {
    Write-Status "PowerShell 5.1 or later required (found: $($PSVersionTable.PSVersion))" "ERROR"
}

# Check for AppLocker module
Write-Status "Checking AppLocker module..." "INFO"
$appLockerModule = Get-Module -ListAvailable -Name AppLocker
if ($appLockerModule) {
    Write-Status "AppLocker module found - OK" "SUCCESS"
    $checks.AppLockerModule = $true
} else {
    Write-Status "AppLocker module not found" "WARNING"
    Write-Status "  AppLocker is included with Windows 10/11 Enterprise and Windows Server" "INFO"
    if ($InstallModules) {
        Write-Status "  Cannot auto-install - AppLocker is a Windows feature" "WARNING"
    }
}

# Check for GroupPolicy module
Write-Status "Checking GroupPolicy module..." "INFO"
$gpModule = Get-Module -ListAvailable -Name GroupPolicy
if ($gpModule) {
    Write-Status "GroupPolicy module found - OK" "SUCCESS"
    $checks.GroupPolicyModule = $true
} else {
    Write-Status "GroupPolicy module not found (optional for deployment)" "WARNING"
    Write-Status "  Install RSAT: Add-WindowsCapability -Online -Name Rsat.GroupPolicy.Management.Tools~~~~0.0.1.0" "INFO"
}

# Check Application Identity service
Write-Status "Checking Application Identity service..." "INFO"
$appIdService = Get-Service -Name AppIDSvc -ErrorAction SilentlyContinue
if ($appIdService) {
    if ($appIdService.Status -eq 'Running') {
        Write-Status "Application Identity service is running - OK" "SUCCESS"
        $checks.ApplicationIdentityService = $true
    } else {
        Write-Status "Application Identity service is not running (Status: $($appIdService.Status))" "WARNING"
        Write-Status "  Start with: Start-Service AppIDSvc" "INFO"
        Write-Status "  Set to Automatic: Set-Service AppIDSvc -StartupType Automatic" "INFO"
    }
} else {
    Write-Status "Application Identity service not found" "ERROR"
    Write-Status "  AppLocker requires this service to function" "ERROR"
}

# Check admin rights
Write-Status "Checking administrator rights..." "INFO"
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Status "Running with administrator rights - OK" "SUCCESS"
    $checks.AdminRights = $true
} else {
    Write-Status "Not running as administrator (some operations require admin rights)" "WARNING"
}

# Import GA-AppLocker module if available
Write-Status ""
Write-Status "Checking GA-AppLocker module..." "INFO"
$modulePath = Join-Path $PSScriptRoot "GA-AppLocker.psm1"
if (Test-Path $modulePath) {
    try {
        Import-Module $modulePath -Force -ErrorAction Stop
        Write-Status "GA-AppLocker module loaded - OK" "SUCCESS"
    } catch {
        Write-Status "Failed to import GA-AppLocker module: $_" "ERROR"
    }
} else {
    Write-Status "GA-AppLocker module not found at: $modulePath" "WARNING"
}

# Summary
Write-Status ""
Write-Status "=== SETUP SUMMARY ===" "INFO"

$passed = ($checks.Values | Where-Object { $_ -eq $true }).Count
$total = $checks.Count
$allPassed = $passed -eq $total

foreach ($check in $checks.GetEnumerator()) {
    $status = if ($check.Value) { "SUCCESS" } else { "WARNING" }
    Write-Status "$($check.Key): $(if ($check.Value) { 'PASS' } else { 'FAIL' })" $status
}

Write-Status ""
if ($allPassed) {
    Write-Status "All checks passed! Environment is ready." "SUCCESS"
    exit 0
} else {
    Write-Status "Some checks failed. Review warnings above." "WARNING"
    Write-Status ""
    Write-Status "For deployment operations, you may need:" "INFO"
    Write-Status "  - Administrator rights" "INFO"
    Write-Status "  - AppLocker PowerShell module" "INFO"
    Write-Status "  - Application Identity service running" "INFO"
    exit 1
}
