# Get-AppLockerAuditLogs.ps1
# GA-ASI AppLocker Audit Log Collection Script
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Collects and analyzes AppLocker audit event logs.

.DESCRIPTION
    This script collects AppLocker events from local or remote systems and provides
    analysis for audit mode operations. Supports Event ID 8003 (would-be-blocked)
    and 8004 (blocked) events.

.PARAMETER ComputerName
    Target computer(s) - defaults to localhost.

.PARAMETER StartTime
    Start time for log collection (default: 24 hours ago).

.PARAMETER EndTime
    End time for log collection (default: now).

.PARAMETER EventID
    Specific Event IDs to collect (default: 8003, 8004, 8006, 8007).

.PARAMETER OutputPath
    Path to save collected logs (CSV format).

.PARAMETER ExportToSIEM
    Export to SIEM format (Splunk/Sentinel).

.EXAMPLE
    .\Get-AppLockerAuditLogs.ps1

.EXAMPLE
    .\Get-AppLockerAuditLogs.ps1 -ComputerName "WS-001", "WS-002" -StartTime (Get-Date).AddDays(-7) -OutputPath "C:\Logs\AppLocker-Audit.csv"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string[]]$ComputerName = $env:COMPUTERNAME,
    
    [Parameter(Mandatory = $false)]
    [DateTime]$StartTime = (Get-Date).AddDays(-1),
    
    [Parameter(Mandatory = $false)]
    [DateTime]$EndTime = (Get-Date),
    
    [Parameter(Mandatory = $false)]
    [int[]]$EventID = @(8003, 8004, 8006, 8007, 8021, 8022),
    
    [Parameter(Mandatory = $false)]
    [string]$OutputPath,
    
    [Parameter(Mandatory = $false)]
    [switch]$ExportToSIEM
)

$ErrorActionPreference = "Continue"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

function Get-AppLockerEvents {
    param(
        [string]$Computer,
        [DateTime]$Start,
        [DateTime]$End,
        [int[]]$IDs
    )
    
    $events = @()
    $logNames = @(
        "Microsoft-Windows-AppLocker/EXE and DLL",
        "Microsoft-Windows-AppLocker/MSI and Script"
    )
    
    foreach ($logName in $logNames) {
        try {
            Write-Log "Collecting events from $logName on $Computer..." "INFO"
            
            $filter = @{
                LogName = $logName
                Id = $IDs
                StartTime = $Start
                EndTime = $End
            }
            
            if ($Computer -ne $env:COMPUTERNAME) {
                $filter.ComputerName = $Computer
            }
            
            $logEvents = Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue
            
            foreach ($event in $logEvents) {
                $xml = [xml]$event.ToXml()
                $eventData = @{}
                
                # Parse event data
                $xml.Event.EventData.Data | ForEach-Object {
                    $eventData[$_.Name] = $_.'#text'
                }
                
                $events += [PSCustomObject]@{
                    ComputerName = $Computer
                    TimeCreated = $event.TimeCreated
                    EventID = $event.Id
                    Level = $event.LevelDisplayName
                    LogName = $logName
                    User = $eventData.User
                    FilePath = $eventData.FilePath
                    Publisher = $eventData.Publisher
                    Hash = $eventData.Hash
                    RuleName = $eventData.RuleName
                    RuleID = $eventData.RuleID
                    PolicyHash = $eventData.PolicyHash
                }
            }
        }
        catch {
            Write-Log "Error collecting events from $logName on $Computer : $_" "WARNING"
        }
    }
    
    return $events
}

try {
    Write-Log "Starting AppLocker audit log collection..." "INFO"
    Write-Log "Time range: $StartTime to $EndTime" "INFO"
    Write-Log "Event IDs: $($EventID -join ', ')" "INFO"
    
    $allEvents = @()
    
    foreach ($computer in $ComputerName) {
        Write-Log "Processing computer: $computer" "INFO"
        $events = Get-AppLockerEvents -Computer $computer -Start $StartTime -End $EndTime -IDs $EventID
        $allEvents += $events
        Write-Log "Collected $($events.Count) events from $computer" "INFO"
    }
    
    Write-Log "Total events collected: $($allEvents.Count)" "INFO"
    
    # Analysis
    if ($allEvents.Count -gt 0) {
        Write-Log "`n=== EVENT SUMMARY ===" "INFO"
        
        $byEventID = $allEvents | Group-Object EventID | Sort-Object Count -Descending
        foreach ($group in $byEventID) {
            Write-Log "Event ID $($group.Name): $($group.Count) events" "INFO"
        }
        
        $byComputer = $allEvents | Group-Object ComputerName | Sort-Object Count -Descending
        Write-Log "`n=== TOP COMPUTERS ===" "INFO"
        foreach ($group in $byComputer | Select-Object -First 10) {
            Write-Log "$($group.Name): $($group.Count) events" "INFO"
        }
        
        $byFilePath = $allEvents | Where-Object { $_.FilePath } | Group-Object FilePath | Sort-Object Count -Descending
        Write-Log "`n=== TOP BLOCKED/ATTEMPTED FILES ===" "INFO"
        foreach ($group in $byFilePath | Select-Object -First 10) {
            Write-Log "$($group.Name): $($group.Count) events" "INFO"
        }
        
        # Export to CSV
        if ($OutputPath) {
            Write-Log "Exporting to CSV: $OutputPath" "INFO"
            $allEvents | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8
            Write-Log "Export completed" "SUCCESS"
        }
        
        # Export to SIEM format
        if ($ExportToSIEM) {
            Write-Log "Exporting to SIEM format..." "INFO"
            $siemPath = $OutputPath -replace '\.csv$', '-SIEM.csv'
            
            $siemEvents = $allEvents | ForEach-Object {
                [PSCustomObject]@{
                    timestamp = $_.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                    host = $_.ComputerName
                    event_id = $_.EventID
                    user = $_.User
                    file_path = $_.FilePath
                    publisher = $_.Publisher
                    hash = $_.Hash
                    rule_name = $_.RuleName
                    source = "AppLocker"
                }
            }
            
            $siemEvents | Export-Csv -Path $siemPath -NoTypeInformation -Encoding UTF8
            Write-Log "SIEM export completed: $siemPath" "SUCCESS"
        }
    }
    else {
        Write-Log "No events found in specified time range" "WARNING"
    }
    
    return $allEvents
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    throw
}
