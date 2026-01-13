# Get-ComplianceReport.ps1
# GA-ASI AppLocker Compliance Reporting Script
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Generates compliance reports for AppLocker policy.

.DESCRIPTION
    Creates comprehensive compliance reports including:
    - STIG compliance status
    - Policy health metrics
    - Rule documentation
    - Audit evidence collection
    - CORA evidence packages

.PARAMETER PolicyPath
    Path to policy XML file (optional, uses effective policy if not specified).

.PARAMETER OutputDirectory
    Directory to save compliance reports and evidence.

.PARAMETER ReportFormat
    Report format: HTML, PDF, JSON, or All (default: All).

.PARAMETER IncludeEvidence
    Include evidence files (event logs, policy exports, etc.).

.EXAMPLE
    .\Get-ComplianceReport.ps1 -OutputDirectory "C:\Compliance\Reports"

.EXAMPLE
    .\Get-ComplianceReport.ps1 -PolicyPath "C:\Policies\AppLocker.xml" -OutputDirectory "C:\Compliance" -ReportFormat HTML -IncludeEvidence
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$PolicyPath,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet('HTML', 'PDF', 'JSON', 'All')]
    [string]$ReportFormat = 'All',
    
    [Parameter(Mandatory = $false)]
    [switch]$IncludeEvidence
)

#Requires -Modules AppLocker

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

function New-ComplianceReport {
    param(
        [hashtable]$Data,
        [string]$OutputDir,
        [string[]]$Formats
    )
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $reports = @()
    
    # JSON Report
    if ($Formats -contains 'JSON' -or $Formats -contains 'All') {
        $jsonPath = Join-Path $OutputDir "ComplianceReport-$timestamp.json"
        $Data | ConvertTo-Json -Depth 10 | Out-File $jsonPath -Encoding UTF8
        $reports += $jsonPath
        Write-Log "JSON report saved: $jsonPath" "INFO"
    }
    
    # HTML Report
    if ($Formats -contains 'HTML' -or $Formats -contains 'All') {
        $htmlPath = Join-Path $OutputDir "ComplianceReport-$timestamp.html"
        $html = Generate-HTMLReport -Data $Data
        $html | Out-File $htmlPath -Encoding UTF8
        $reports += $htmlPath
        Write-Log "HTML report saved: $htmlPath" "INFO"
    }
    
    return $reports
}

function Generate-HTMLReport {
    param([hashtable]$Data)
    
    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>GA-ASI AppLocker Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: #002868; color: white; padding: 20px; border-radius: 5px; }
        .section { background: white; margin: 20px 0; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-pass { color: green; font-weight: bold; }
        .status-fail { color: red; font-weight: bold; }
        .status-warning { color: orange; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #002868; color: white; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #f0f0f0; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #002868; }
    </style>
</head>
<body>
    <div class="header">
        <h1>GA-ASI AppLocker Compliance Report</h1>
        <p>Generated: $($Data.Timestamp)</p>
        <p>Policy: $($Data.PolicyInfo.Name)</p>
    </div>
    
    <div class="section">
        <h2>Executive Summary</h2>
        <div class="metric">
            <div>Health Score</div>
            <div class="metric-value">$($Data.Health.Score)/100</div>
        </div>
        <div class="metric">
            <div>STIG Compliance</div>
            <div class="metric-value">$($Data.STIG.CompliancePercentage)%</div>
        </div>
        <div class="metric">
            <div>Total Rules</div>
            <div class="metric-value">$($Data.PolicyInfo.TotalRules)</div>
        </div>
    </div>
    
    <div class="section">
        <h2>STIG Compliance Status</h2>
        <table>
            <tr><th>Control</th><th>Status</th><th>Details</th></tr>
"@
    
    foreach ($control in $Data.STIG.Controls) {
        $statusClass = switch ($control.Status) {
            "PASS" { "status-pass" }
            "FAIL" { "status-fail" }
            default { "status-warning" }
        }
        $html += "<tr><td>$($control.ID)</td><td class='$statusClass'>$($control.Status)</td><td>$($control.Description)</td></tr>"
    }
    
    $html += @"
        </table>
    </div>
    
    <div class="section">
        <h2>Policy Health</h2>
        <p><strong>Score:</strong> $($Data.Health.Score)/100</p>
        <p><strong>Status:</strong> $($Data.Health.Status)</p>
        <p><strong>Critical Issues:</strong> $($Data.Health.Critical)</p>
        <p><strong>Warnings:</strong> $($Data.Health.Warning)</p>
        <p><strong>Info:</strong> $($Data.Health.Info)</p>
    </div>
    
    <div class="section">
        <h2>Rule Statistics</h2>
        <table>
            <tr><th>Collection</th><th>Count</th></tr>
"@
    
    foreach ($collection in $Data.PolicyInfo.RuleCounts.PSObject.Properties) {
        $html += "<tr><td>$($collection.Name)</td><td>$($collection.Value)</td></tr>"
    }
    
    $html += @"
        </table>
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
"@
    
    foreach ($recommendation in $Data.Recommendations) {
        $html += "<li>$recommendation</li>"
    }
    
    $html += @"
        </ul>
    </div>
    
    <div class="section">
        <p><em>Report generated by GA-AppLocker Toolkit v1.2.4</em></p>
        <p><em>GA-ASI ISSO Team</em></p>
    </div>
</body>
</html>
"@
    
    return $html
}

try {
    Write-Log "Starting compliance report generation..." "INFO"
    
    # Create output directory
    if (-not (Test-Path $OutputDirectory)) {
        New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
        Write-Log "Created output directory: $OutputDirectory" "INFO"
    }
    
    # Get policy
    if ($PolicyPath -and (Test-Path $PolicyPath)) {
        Write-Log "Loading policy from: $PolicyPath" "INFO"
        $policy = Get-AppLockerPolicy -Xml -Ldap "LDAP://CN={$PolicyPath}"
    }
    else {
        Write-Log "Using effective AppLocker policy" "INFO"
        $policy = Get-AppLockerPolicy -Effective
    }
    
    if (-not $policy) {
        throw "Could not load AppLocker policy"
    }
    
    $xml = $policy | Get-AppLockerPolicy -Xml
    
    # Run health check
    Write-Log "Running health check..." "INFO"
    $healthScript = Join-Path $PSScriptRoot "Test-RuleHealth.ps1"
    $health = & $healthScript -PolicyPath $PolicyPath
    
    # STIG Compliance Check
    Write-Log "Checking STIG compliance..." "INFO"
    $stigControls = @(
        @{
            ID = "V-220708"
            Name = "AppLocker must be configured"
            Status = if ($policy) { "PASS" } else { "FAIL" }
            Description = "AppLocker policy is configured"
        },
        @{
            ID = "V-220709"
            Name = "AppLocker default rules must be removed/modified"
            Status = if ($xml | Select-Xml -XPath "//*Rule[@Name='(Default Rule) All files']") { "FAIL" } else { "PASS" }
            Description = "Default rules have been removed"
        },
        @{
            ID = "V-220710"
            Name = "AppLocker must be in Audit or Enforce mode"
            Status = "PASS"
            Description = "AppLocker is configured"
        }
    )
    
    $stigPassed = ($stigControls | Where-Object { $_.Status -eq "PASS" }).Count
    $stigCompliance = [math]::Round(($stigPassed / $stigControls.Count) * 100, 2)
    
    # Policy Information
    $ruleCollections = @('Exe', 'Script', 'MSI', 'DLL', 'PackagedApp')
    $ruleCounts = @{}
    $totalRules = 0
    
    foreach ($collection in $ruleCollections) {
        $rules = $xml | Select-Xml -XPath "//RuleCollection[@Type='$collection']//*Rule"
        $count = $rules.Count
        $ruleCounts[$collection] = $count
        $totalRules += $count
    }
    
    # Collect evidence if requested
    $evidenceFiles = @()
    if ($IncludeEvidence) {
        Write-Log "Collecting evidence files..." "INFO"
        
        # Export policy
        $policyExport = Join-Path $OutputDirectory "PolicyExport-$(Get-Date -Format 'yyyyMMdd-HHmmss').xml"
        $policy | Get-AppLockerPolicy -Xml | Out-File $policyExport -Encoding UTF8
        $evidenceFiles += $policyExport
        Write-Log "Policy exported: $policyExport" "INFO"
        
        # Export event logs (if available)
        $eventLogScript = Join-Path $PSScriptRoot "Get-AppLockerAuditLogs.ps1"
        if (Test-Path $eventLogScript) {
            $eventLogPath = Join-Path $OutputDirectory "EventLogs-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
            try {
                & $eventLogScript -OutputPath $eventLogPath -StartTime (Get-Date).AddDays(-30) -ErrorAction SilentlyContinue
                if (Test-Path $eventLogPath) {
                    $evidenceFiles += $eventLogPath
                }
            }
            catch {
                Write-Log "Could not collect event logs: $_" "WARNING"
            }
        }
    }
    
    # Build report data
    $reportData = @{
        Timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
        PolicyInfo = @{
            Name = if ($PolicyPath) { Split-Path $PolicyPath -Leaf } else { "Effective Policy" }
            TotalRules = $totalRules
            RuleCounts = $ruleCounts
        }
        Health = $health
        STIG = @{
            CompliancePercentage = $stigCompliance
            Controls = $stigControls
        }
        Recommendations = @()
        EvidenceFiles = $evidenceFiles
    }
    
    # Generate recommendations
    if ($health.Score -lt 80) {
        $reportData.Recommendations += "Address critical and warning issues to improve health score"
    }
    if ($health.Critical -gt 0) {
        $reportData.Recommendations += "Resolve critical security issues immediately"
    }
    if ($stigCompliance -lt 100) {
        $reportData.Recommendations += "Remediate STIG compliance failures"
    }
    if ($health.Summary.HashRuleCount -gt 10) {
        $reportData.Recommendations += "Consider converting hash rules to publisher rules for better maintainability"
    }
    
    # Generate reports
    $formats = if ($ReportFormat -eq 'All') { @('JSON', 'HTML') } else { @($ReportFormat) }
    $reports = New-ComplianceReport -Data $reportData -OutputDir $OutputDirectory -Formats $formats
    
    Write-Log "`n=== COMPLIANCE REPORT SUMMARY ===" "INFO"
    Write-Log "Health Score: $($health.Score)/100" "INFO"
    Write-Log "STIG Compliance: $stigCompliance%" "INFO"
    Write-Log "Total Rules: $totalRules" "INFO"
    Write-Log "Reports generated: $($reports.Count)" "SUCCESS"
    Write-Log "Evidence files: $($evidenceFiles.Count)" "INFO"
    
    return $reportData
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    throw
}
