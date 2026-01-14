# Start-BatchScan.ps1
# GA-ASI Batch Scanning Script with Credential Support
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOIS
    Performs batch scanning of multiple machines via WinRM with credential support.

.DESCRIPTION
    Scans multiple machines for AppLocker artifacts using WinRM. Supports both
    current user credentials and explicit domain credentials.

.PARAMETER ComputerNames
    Array of computer names to scan. If not provided, discovers from AD.

.PARAMETER TargetOUs
    Array of OU paths to discover machines from (e.g., "OU=Workstations,DC=domain,DC=local").

.PARAMETER Username
    Username for remote scanning (optional if using current user).

.PARAMETER Password
    Password for remote scanning (optional if using current user).
    SECURITY NOTE: Prefer using -PasswordEnvVar instead to avoid passwords in process listings.

.PARAMETER PasswordEnvVar
    Name of environment variable containing the password. More secure than -Password
    as it avoids exposing credentials in process command line arguments.

.PARAMETER Domain
    Domain name for credentials (optional).

.PARAMETER UseCurrentUser
    Use current Windows credentials (default: $true).

.PARAMETER OutputDirectory
    Directory to save scan results (default: C:\Scans).

.PARAMETER IncludeEventLogs
    Include AppLocker event logs in scan.

.PARAMETER IncludeWritablePaths
    Scan writable paths for executables.

.EXAMPLE
    .\Start-BatchScan.ps1 -TargetOUs @("OU=Workstations,DC=GA-ASI,DC=LOCAL") -UseCurrentUser

.EXAMPLE
    .\Start-BatchScan.ps1 -ComputerNames @("WS-001", "WS-002") -Username "scanuser" -Password "SecurePass123!" -Domain "GA-ASI"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string[]]$ComputerNames,
    
    [Parameter(Mandatory = $false)]
    [string[]]$TargetOUs,
    
    [Parameter(Mandatory = $false)]
    [string]$Username,
    
    [Parameter(Mandatory = $false)]
    [string]$Password,

    [Parameter(Mandatory = $false)]
    [string]$PasswordEnvVar,

    [Parameter(Mandatory = $false)]
    [string]$Domain,
    
    [Parameter(Mandatory = $false)]
    [switch]$UseCurrentUser = $true,
    
    [Parameter(Mandatory = $false)]
    [string]$OutputDirectory = "C:\Scans",
    
    [Parameter(Mandatory = $false)]
    [switch]$IncludeEventLogs,
    
    [Parameter(Mandatory = $false)]
    [switch]$IncludeWritablePaths
    ,
    [Parameter(Mandatory = $false)]
    [switch]$OnlineOnly
)

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

# Create credential object if provided
$Credential = $null
$ActualPassword = $null

# SECURITY: Prefer environment variable for password to avoid command-line exposure
if ($PasswordEnvVar -and (Test-Path "env:$PasswordEnvVar")) {
    $ActualPassword = [Environment]::GetEnvironmentVariable($PasswordEnvVar)
    # Clear the environment variable after reading for security
    [Environment]::SetEnvironmentVariable($PasswordEnvVar, $null)
    Write-Log "Password retrieved from environment variable (secure method)" "INFO"
} elseif ($Password) {
    $ActualPassword = $Password
    Write-Log "Using password from command line (less secure - consider using -PasswordEnvVar)" "WARNING"
}

if ($UseCurrentUser) {
    Write-Log "Using current user credentials for remote scanning" "INFO"
} else {
    if (-not $Username -or -not $ActualPassword) {
        throw "UseCurrentUser is set to false, but username/password were not provided."
    }

    $SecurePassword = ConvertTo-SecureString -String $ActualPassword -AsPlainText -Force
    # Clear plaintext password from memory
    $ActualPassword = $null
    if ($Domain) {
        $Credential = New-Object System.Management.Automation.PSCredential("$Domain\$Username", $SecurePassword)
    } else {
        $Credential = New-Object System.Management.Automation.PSCredential($Username, $SecurePassword)
    }
    Write-Log "Using provided credentials for remote scanning" "INFO"
}

# Discover machines from AD if ComputerNames not provided
if (-not $ComputerNames -and $TargetOUs) {
    Write-Log "Discovering machines from Active Directory..." "INFO"
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
        $ComputerNames = @()
        foreach ($OU in $TargetOUs) {
            $computers = Get-ADComputer -Filter * -SearchBase $OU -Properties Name, OperatingSystem | 
                Where-Object { $_.OperatingSystem -like "*Windows*" } | 
                Select-Object -ExpandProperty Name
            $ComputerNames += $computers
        }
        Write-Log "Discovered $($ComputerNames.Count) machines from AD" "SUCCESS"
    } catch {
        Write-Log "Failed to discover machines from AD: $_" "ERROR"
        throw
    }
}

if (-not $ComputerNames -or $ComputerNames.Count -eq 0) {
    throw "No computers specified for scanning. Provide ComputerNames or TargetOUs."
}

# Create output directory
if (-not (Test-Path $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScanScript = Join-Path $ScriptDir "Get-ComprehensiveScanArtifacts.ps1"

if (-not (Test-Path $ScanScript)) {
    throw "Scan script not found: $ScanScript"
}

$Results = @{
    TotalMachines = $ComputerNames.Count
    Successful = 0
    Failed = 0
    Skipped = 0
    Results = @()
}

# Scan each machine
foreach ($ComputerName in $ComputerNames) {
    Write-Log "Scanning $ComputerName..." "INFO"
    
    $OperatingSystem = $null
    if (Get-Command Get-ADComputer -ErrorAction SilentlyContinue) {
        try {
            $OperatingSystem = (Get-ADComputer -Identity $ComputerName -Properties OperatingSystem -ErrorAction Stop).OperatingSystem
        } catch {
            Write-Log "Unable to determine OS for $ComputerName : $_" "WARNING"
        }
    }

    if ($OperatingSystem -and $OperatingSystem -notlike "*Windows*") {
        $Results.Skipped++
        $Results.Results += @{
            ComputerName = $ComputerName
            Status = "NonWindows"
            OperatingSystem = $OperatingSystem
            PingStatus = "Unknown"
            WinRMStatus = "Unknown"
        }
        Write-Log "Skipping $ComputerName (non-Windows OS: $OperatingSystem)" "WARNING"
        continue
    }

    $PingOnline = $false
    try {
        $PingOnline = Test-Connection -ComputerName $ComputerName -Count 1 -Quiet -ErrorAction SilentlyContinue
    } catch {
        $PingOnline = $false
    }

    if (-not $PingOnline) {
        $Results.Skipped++
        $Results.Results += @{
            ComputerName = $ComputerName
            Status = "Offline"
            OperatingSystem = $OperatingSystem
            PingStatus = "Offline"
            WinRMStatus = "Unknown"
        }
        Write-Log "Skipping $ComputerName (offline/unreachable)" "WARNING"
        continue
    }

    $WinRMAvailable = $false
    $WinRMError = $null
    try {
        Test-WSMan -ComputerName $ComputerName -ErrorAction Stop | Out-Null
        $WinRMAvailable = $true
    } catch {
        $WinRMAvailable = $false
        $WinRMError = $_.Exception.Message
    }

    if (-not $WinRMAvailable) {
        $Results.Skipped++
        $Results.Results += @{
            ComputerName = $ComputerName
            Status = "WinRMUnavailable"
            OperatingSystem = $OperatingSystem
            PingStatus = "Online"
            WinRMStatus = "Unavailable"
            Error = $WinRMError
        }
        Write-Log "Skipping $ComputerName (WinRM unavailable)" "WARNING"
        continue
    }

    $OutputPath = Join-Path $OutputDirectory "artifacts-$ComputerName-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    
    try {
        # Build script arguments
        $ScriptBlock = {
            param($OutputPath, $IncludeEventLogs, $IncludeWritablePaths)
            
            & "$using:ScanScript" `
                -ComputerName $env:COMPUTERNAME `
                -OutputPath $OutputPath `
                -IncludeEventLogs:$IncludeEventLogs `
                -IncludeWritablePaths:$IncludeWritablePaths `
                -IncludeSystemPaths
        }
        
        # Execute remotely with credentials
        if ($Credential) {
            Invoke-Command -ComputerName $ComputerName -Credential $Credential -ScriptBlock $ScriptBlock `
                -ArgumentList $OutputPath, $IncludeEventLogs.IsPresent, $IncludeWritablePaths.IsPresent `
                -ErrorAction Stop
        } else {
            Invoke-Command -ComputerName $ComputerName -ScriptBlock $ScriptBlock `
                -ArgumentList $OutputPath, $IncludeEventLogs.IsPresent, $IncludeWritablePaths.IsPresent `
                -ErrorAction Stop
        }
        
        $Results.Successful++
        $Results.Results += @{
            ComputerName = $ComputerName
            Status = "Success"
            OutputPath = $OutputPath
            OperatingSystem = $OperatingSystem
            PingStatus = "Online"
            WinRMStatus = "Available"
        }
        Write-Log "Successfully scanned $ComputerName" "SUCCESS"
    } catch {
        $Results.Failed++
        $Results.Results += @{
            ComputerName = $ComputerName
            Status = "Failed"
            Error = $_.Exception.Message
            OperatingSystem = $OperatingSystem
            PingStatus = "Online"
            WinRMStatus = "Available"
        }
        Write-Log "Failed to scan $ComputerName : $_" "ERROR"
    }
}

# Export summary
$SummaryPath = Join-Path $OutputDirectory "scan-summary-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$Results | ConvertTo-Json -Depth 10 | Out-File $SummaryPath -Encoding UTF8

Write-Log "`n=== SCAN SUMMARY ===" "INFO"
Write-Log "Total Machines: $($Results.TotalMachines)" "INFO"
Write-Log "Successful: $($Results.Successful)" "SUCCESS"
Write-Log "Failed: $($Results.Failed)" "ERROR"
Write-Log "Skipped: $($Results.Skipped)" "WARNING"
Write-Log "Summary saved to: $SummaryPath" "INFO"

$ResultJson = $Results | ConvertTo-Json -Depth 10 -Compress
Write-Output "GA_APPLOCKER_SCAN_RESULT_START"
Write-Output $ResultJson
Write-Output "GA_APPLOCKER_SCAN_RESULT_END"

return $Results
