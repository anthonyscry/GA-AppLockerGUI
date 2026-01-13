# Get-ComprehensiveScanArtifacts.ps1
# GA-ASI Comprehensive Scanning Artifact Collector
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Collects comprehensive scanning artifacts for AppLocker rule generation.

.DESCRIPTION
    This script collects all executable files, software inventory, event viewer logs,
    writable paths, and other artifacts needed for comprehensive rule generation.

.PARAMETER ComputerName
    Target computer name (default: localhost).

.PARAMETER OutputPath
    Path to save collected artifacts JSON file.

.PARAMETER IncludeEventLogs
    Include AppLocker event logs (8003/8004).

.PARAMETER IncludeWritablePaths
    Scan for executables in writable paths.

.PARAMETER IncludeSystemPaths
    Include system paths (Program Files, Windows, etc.).

.EXAMPLE
    .\Get-ComprehensiveScanArtifacts.ps1 -OutputPath "C:\Scans\artifacts.json" -IncludeEventLogs -IncludeWritablePaths
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ComputerName = $env:COMPUTERNAME,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    
    [Parameter(Mandatory = $false)]
    [switch]$IncludeEventLogs,
    
    [Parameter(Mandatory = $false)]
    [switch]$IncludeWritablePaths,
    
    [Parameter(Mandatory = $false)]
    [switch]$IncludeSystemPaths = $true,
    
    [Parameter(Mandatory = $false)]
    [string]$Username,
    
    [Parameter(Mandatory = $false)]
    [string]$Password,
    
    [Parameter(Mandatory = $false)]
    [string]$Domain
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

# Create credential object if provided
$Credential = $null
if ($Username -and $Password) {
    $SecurePassword = ConvertTo-SecureString -String $Password -AsPlainText -Force
    if ($Domain) {
        $Credential = New-Object System.Management.Automation.PSCredential("$Domain\$Username", $SecurePassword)
    } else {
        $Credential = New-Object System.Management.Automation.PSCredential($Username, $SecurePassword)
    }
    Write-Log "Using provided credentials for remote operations" "INFO"
} else {
    Write-Log "Using current user credentials for remote operations" "INFO"
}

function Get-FilePublisher {
    param([string]$FilePath)
    
    try {
        $sig = Get-AuthenticodeSignature -FilePath $FilePath -ErrorAction SilentlyContinue
        if ($sig -and $sig.Status -eq 'Valid') {
            return $sig.SignerCertificate.Subject
        }
    }
    catch {
        # File may not exist or may not be signed
    }
    
    return $null
}

function Get-FileHash {
    param([string]$FilePath)
    
    try {
        return (Get-FileHash -Path $FilePath -Algorithm SHA256).Hash
    }
    catch {
        return $null
    }
}

try {
    Write-Log "Starting comprehensive artifact collection..." "INFO"
    
    $artifacts = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        ComputerName = $ComputerName
        Executables = @()
        SoftwareInventory = @()
        EventLogs = @()
        WritablePaths = @()
        SystemPaths = @()
        Statistics = @{}
    }
    
    # Collect executables from system paths
    if ($IncludeSystemPaths) {
        Write-Log "Scanning system paths for executables..." "INFO"
        $systemPaths = @(
            "$env:ProgramFiles\*",
            "${env:ProgramFiles(x86)}\*",
            "$env:ProgramData\*",
            "$env:SystemRoot\System32\*",
            "$env:SystemRoot\SysWOW64\*"
        )
        
        foreach ($pathPattern in $systemPaths) {
            try {
                $files = Get-ChildItem -Path $pathPattern -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1000
                foreach ($file in $files) {
                    $publisher = Get-FilePublisher -FilePath $file.FullName
                    $hash = Get-FileHash -FilePath $file.FullName
                    
                    $artifacts.Executables += @{
                        Path = $file.FullName
                        Name = $file.Name
                        Publisher = $publisher
                        Hash = $hash
                        Size = $file.Length
                        LastModified = $file.LastWriteTime
                        Type = 'EXE'
                    }
                }
            }
            catch {
                Write-Log "Error scanning $pathPattern : $_" "WARNING"
            }
        }
    }
    
    # Collect from writable paths
    if ($IncludeWritablePaths) {
        Write-Log "Scanning writable paths..." "INFO"
        $writablePaths = @(
            "$env:USERPROFILE\AppData\Local\*",
            "$env:USERPROFILE\AppData\Roaming\*",
            "$env:TEMP\*"
        )
        
        foreach ($pathPattern in $writablePaths) {
            try {
                $files = Get-ChildItem -Path $pathPattern -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 500
                foreach ($file in $files) {
                    $artifacts.WritablePaths += @{
                        Path = $file.FullName
                        Name = $file.Name
                        Hash = Get-FileHash -FilePath $file.FullName
                        LastModified = $file.LastWriteTime
                    }
                }
            }
            catch {
                Write-Log "Error scanning writable path $pathPattern : $_" "WARNING"
            }
        }
    }
    
    # Collect software inventory
    Write-Log "Collecting software inventory..." "INFO"
    try {
        $software = Get-WmiObject -Class Win32_Product -ErrorAction SilentlyContinue | Select-Object Name, Version, Vendor, InstallDate
        foreach ($app in $software) {
            $artifacts.SoftwareInventory += @{
                Name = $app.Name
                Version = $app.Version
                Publisher = $app.Vendor
                InstallDate = $app.InstallDate
            }
        }
    }
    catch {
        Write-Log "Error collecting software inventory: $_" "WARNING"
    }
    
    # Collect event logs
    if ($IncludeEventLogs) {
        Write-Log "Collecting AppLocker event logs..." "INFO"
        try {
            $events = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-AppLocker/EXE and DLL'; ID=8003,8004} -MaxEvents 1000 -ErrorAction SilentlyContinue
            foreach ($event in $events) {
                $artifacts.EventLogs += @{
                    EventId = $event.Id
                    TimeCreated = $event.TimeCreated
                    Message = $event.Message
                    Path = ($event.Properties | Where-Object {$_.Path -like '*Path*'}).Value
                }
            }
        }
        catch {
            Write-Log "Error collecting event logs: $_" "WARNING"
        }
    }
    
    # Calculate statistics
    $artifacts.Statistics = @{
        TotalExecutables = $artifacts.Executables.Count
        TotalSoftware = $artifacts.SoftwareInventory.Count
        TotalEvents = $artifacts.EventLogs.Count
        WritablePathExecutables = $artifacts.WritablePaths.Count
        UniquePublishers = ($artifacts.Executables | Where-Object {$_.Publisher} | Select-Object -Unique Publisher).Count
    }
    
    # Remove duplicates based on path and hash
    Write-Log "Removing duplicates..." "INFO"
    $uniqueExecutables = $artifacts.Executables | Sort-Object Path -Unique
    $artifacts.Executables = $uniqueExecutables
    
    # Save artifacts
    Write-Log "Saving artifacts to: $OutputPath" "INFO"
    $artifacts | ConvertTo-Json -Depth 10 | Out-File $OutputPath -Encoding UTF8
    
    Write-Log "`n=== COLLECTION STATISTICS ===" "INFO"
    Write-Log "Executables found: $($artifacts.Statistics.TotalExecutables)" "INFO"
    Write-Log "Software items: $($artifacts.Statistics.TotalSoftware)" "INFO"
    Write-Log "Event log entries: $($artifacts.Statistics.TotalEvents)" "INFO"
    Write-Log "Unique publishers: $($artifacts.Statistics.UniquePublishers)" "INFO"
    Write-Log "Artifacts saved to: $OutputPath" "SUCCESS"
    
    return $artifacts
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    throw
}
