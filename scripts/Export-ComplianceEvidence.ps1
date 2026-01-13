<#
.SYNOPSIS
    Exports comprehensive compliance evidence for AppLocker policies.

.DESCRIPTION
    Collects and exports all evidence required for compliance audits including:
    - Current AppLocker policies
    - Audit event logs
    - System configuration snapshots
    - Policy deployment history

.PARAMETER OutputDirectory
    The directory where evidence will be exported.

.NOTES
    Requires: AppLocker, EventLog access, Admin privileges
    Author: GA-ASI AppLocker Toolkit
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$OutputDirectory = "C:\AppLockerEvidence",

    [Parameter()]
    [int]$EventLogDays = 30,

    [Parameter()]
    [switch]$IncludeSystemInfo = $true
)

$ErrorActionPreference = "Stop"

try {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $evidenceRoot = Join-Path $OutputDirectory "Evidence_$timestamp"

    Write-Host "=== AppLocker Compliance Evidence Export ===" -ForegroundColor Cyan
    Write-Host "Output Directory: $evidenceRoot" -ForegroundColor White
    Write-Host ""

    # Create directory structure
    $directories = @(
        "policies",
        "audit-logs",
        "snapshots",
        "reports",
        "configuration"
    )

    foreach ($dir in $directories) {
        $path = Join-Path $evidenceRoot $dir
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }

    Write-Host "Created evidence directory structure" -ForegroundColor Green

    # 1. Export Current AppLocker Policies
    Write-Host "`n[1/5] Exporting AppLocker Policies..." -ForegroundColor Yellow

    try {
        $effectivePolicy = Get-AppLockerPolicy -Effective -ErrorAction SilentlyContinue
        if ($effectivePolicy) {
            $policyPath = Join-Path $evidenceRoot "policies\EffectivePolicy.xml"
            $effectivePolicy | Set-Content -Path $policyPath -Encoding UTF8
            Write-Host "  - Effective policy exported" -ForegroundColor Green
        }

        $localPolicy = Get-AppLockerPolicy -Local -ErrorAction SilentlyContinue
        if ($localPolicy) {
            $localPolicyPath = Join-Path $evidenceRoot "policies\LocalPolicy.xml"
            $localPolicy | Set-Content -Path $localPolicyPath -Encoding UTF8
            Write-Host "  - Local policy exported" -ForegroundColor Green
        }

        # Export policy summary
        $policySummary = @{
            ExportDate = (Get-Date).ToString("o")
            EffectivePolicyExists = ($null -ne $effectivePolicy)
            LocalPolicyExists = ($null -ne $localPolicy)
            RuleCollections = @()
        }

        if ($effectivePolicy) {
            foreach ($collection in $effectivePolicy.RuleCollections) {
                $policySummary.RuleCollections += @{
                    Type = $collection.RuleCollectionType
                    EnforcementMode = $collection.EnforcementMode.ToString()
                    RuleCount = $collection.Count
                }
            }
        }

        $policySummary | ConvertTo-Json -Depth 5 |
            Set-Content -Path (Join-Path $evidenceRoot "policies\PolicySummary.json") -Encoding UTF8

    } catch {
        Write-Warning "Could not export AppLocker policies: $_"
    }

    # 2. Export Audit Event Logs
    Write-Host "`n[2/5] Collecting Audit Event Logs..." -ForegroundColor Yellow

    try {
        $startDate = (Get-Date).AddDays(-$EventLogDays)

        $logNames = @(
            "Microsoft-Windows-AppLocker/EXE and DLL",
            "Microsoft-Windows-AppLocker/MSI and Script",
            "Microsoft-Windows-AppLocker/Packaged app-Deployment",
            "Microsoft-Windows-AppLocker/Packaged app-Execution"
        )

        $allEvents = @()

        foreach ($logName in $logNames) {
            try {
                $events = Get-WinEvent -LogName $logName -ErrorAction SilentlyContinue |
                    Where-Object { $_.TimeCreated -ge $startDate }

                if ($events) {
                    $allEvents += $events
                    Write-Host "  - $logName`: $($events.Count) events" -ForegroundColor Green
                }
            } catch {
                Write-Host "  - $logName`: No events or access denied" -ForegroundColor Gray
            }
        }

        if ($allEvents.Count -gt 0) {
            # Export to CSV
            $csvPath = Join-Path $evidenceRoot "audit-logs\AppLockerEvents.csv"
            $allEvents | Select-Object TimeCreated, Id, LevelDisplayName, Message, MachineName |
                Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

            # Export summary statistics
            $eventStats = @{
                ExportDate = (Get-Date).ToString("o")
                DateRange = @{
                    Start = $startDate.ToString("o")
                    End = (Get-Date).ToString("o")
                }
                TotalEvents = $allEvents.Count
                ByEventId = ($allEvents | Group-Object Id | ForEach-Object {
                    @{ EventId = $_.Name; Count = $_.Count }
                })
                ByLevel = ($allEvents | Group-Object LevelDisplayName | ForEach-Object {
                    @{ Level = $_.Name; Count = $_.Count }
                })
            }

            $eventStats | ConvertTo-Json -Depth 5 |
                Set-Content -Path (Join-Path $evidenceRoot "audit-logs\EventStatistics.json") -Encoding UTF8
        }

    } catch {
        Write-Warning "Could not collect audit logs: $_"
    }

    # 3. Create System Snapshot
    Write-Host "`n[3/5] Creating System Snapshot..." -ForegroundColor Yellow

    if ($IncludeSystemInfo) {
        try {
            $snapshot = @{
                Timestamp = (Get-Date).ToString("o")
                ComputerName = $env:COMPUTERNAME
                Domain = $env:USERDOMAIN
                OSVersion = (Get-CimInstance Win32_OperatingSystem).Caption
                OSBuild = (Get-CimInstance Win32_OperatingSystem).BuildNumber
                AppLockerServiceStatus = (Get-Service AppIDSvc -ErrorAction SilentlyContinue).Status.ToString()
                PowerShellVersion = $PSVersionTable.PSVersion.ToString()
                ExecutionPolicy = (Get-ExecutionPolicy).ToString()
            }

            # Check for required modules
            $snapshot.Modules = @{
                AppLocker = (Get-Module -ListAvailable AppLocker -ErrorAction SilentlyContinue) -ne $null
                GroupPolicy = (Get-Module -ListAvailable GroupPolicy -ErrorAction SilentlyContinue) -ne $null
                ActiveDirectory = (Get-Module -ListAvailable ActiveDirectory -ErrorAction SilentlyContinue) -ne $null
            }

            $snapshot | ConvertTo-Json -Depth 5 |
                Set-Content -Path (Join-Path $evidenceRoot "snapshots\SystemSnapshot.json") -Encoding UTF8

            Write-Host "  - System snapshot created" -ForegroundColor Green

        } catch {
            Write-Warning "Could not create system snapshot: $_"
        }
    }

    # 4. Generate Compliance Report
    Write-Host "`n[4/5] Generating Compliance Report..." -ForegroundColor Yellow

    try {
        $complianceReport = @{
            GeneratedAt = (Get-Date).ToString("o")
            GeneratedBy = "$env:USERDOMAIN\$env:USERNAME"
            MachineName = $env:COMPUTERNAME
            EvidenceDirectory = $evidenceRoot
            Checks = @()
        }

        # Check: AppLocker Service Running
        $appIdSvc = Get-Service AppIDSvc -ErrorAction SilentlyContinue
        $complianceReport.Checks += @{
            Name = "AppLocker Service Status"
            Status = if ($appIdSvc.Status -eq "Running") { "PASS" } else { "FAIL" }
            Details = "Service status: $($appIdSvc.Status)"
        }

        # Check: Policies Configured
        $hasPolicy = (Get-AppLockerPolicy -Effective -ErrorAction SilentlyContinue) -ne $null
        $complianceReport.Checks += @{
            Name = "AppLocker Policies Configured"
            Status = if ($hasPolicy) { "PASS" } else { "FAIL" }
            Details = if ($hasPolicy) { "Effective policy found" } else { "No effective policy" }
        }

        # Check: Audit Mode or Enforce Mode
        if ($hasPolicy) {
            $policy = Get-AppLockerPolicy -Effective
            $enforceModes = $policy.RuleCollections | ForEach-Object { $_.EnforcementMode }
            $hasEnforcement = $enforceModes -contains "Enabled"

            $complianceReport.Checks += @{
                Name = "Policy Enforcement"
                Status = if ($hasEnforcement) { "ENFORCED" } else { "AUDIT_ONLY" }
                Details = "Modes: $($enforceModes -join ', ')"
            }
        }

        # Calculate overall score
        $passCount = ($complianceReport.Checks | Where-Object { $_.Status -eq "PASS" -or $_.Status -eq "ENFORCED" }).Count
        $totalChecks = $complianceReport.Checks.Count
        $complianceReport.Score = [math]::Round(($passCount / $totalChecks) * 100, 1)

        $complianceReport | ConvertTo-Json -Depth 5 |
            Set-Content -Path (Join-Path $evidenceRoot "reports\ComplianceReport.json") -Encoding UTF8

        Write-Host "  - Compliance report generated (Score: $($complianceReport.Score)%)" -ForegroundColor Green

    } catch {
        Write-Warning "Could not generate compliance report: $_"
    }

    # 5. Create Evidence Manifest
    Write-Host "`n[5/5] Creating Evidence Manifest..." -ForegroundColor Yellow

    $manifest = @{
        CreatedAt = (Get-Date).ToString("o")
        CreatedBy = "$env:USERDOMAIN\$env:USERNAME"
        EvidenceRoot = $evidenceRoot
        Files = @()
    }

    Get-ChildItem -Path $evidenceRoot -Recurse -File | ForEach-Object {
        $manifest.Files += @{
            Path = $_.FullName.Replace($evidenceRoot, ".")
            Size = $_.Length
            Hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
            Modified = $_.LastWriteTime.ToString("o")
        }
    }

    $manifest | ConvertTo-Json -Depth 5 |
        Set-Content -Path (Join-Path $evidenceRoot "MANIFEST.json") -Encoding UTF8

    Write-Host "  - Evidence manifest created with $($manifest.Files.Count) files" -ForegroundColor Green

    # Final Summary
    Write-Host "`n=== Export Complete ===" -ForegroundColor Cyan
    Write-Host "Evidence Location: $evidenceRoot" -ForegroundColor White
    Write-Host "Total Files: $($manifest.Files.Count)" -ForegroundColor White

    @{
        success = $true
        outputPath = $evidenceRoot
        fileCount = $manifest.Files.Count
        timestamp = $timestamp
    } | ConvertTo-Json -Compress

} catch {
    Write-Error "Failed to export compliance evidence: $_"
    @{
        success = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
    exit 1
}
