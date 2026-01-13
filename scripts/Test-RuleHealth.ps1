# Test-RuleHealth.ps1
# GA-ASI AppLocker Rule Health Check Script
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Performs comprehensive health check on AppLocker policy.

.DESCRIPTION
    Analyzes AppLocker policy for security issues, maintenance concerns, and best practices.
    Returns a health score (0-100) with detailed findings.

.PARAMETER PolicyPath
    Path to policy XML file (optional, uses effective policy if not specified).

.PARAMETER OutputPath
    Path to save health check report (JSON format).

.EXAMPLE
    .\Test-RuleHealth.ps1

.EXAMPLE
    .\Test-RuleHealth.ps1 -PolicyPath "C:\Policies\AppLocker.xml" -OutputPath "C:\Reports\HealthCheck.json"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$PolicyPath,
    
    [Parameter(Mandatory = $false)]
    [string]$OutputPath
)

#Requires -Modules AppLocker

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "CRITICAL" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

try {
    Write-Log "Starting AppLocker rule health check..." "INFO"
    
    $health = @{
        Timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
        Critical = 0
        Warning = 0
        Info = 0
        Score = 100
        Findings = @()
        Summary = @{}
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
    
    # Check Application Identity service
    Write-Log "Checking Application Identity service..." "INFO"
    $appIdService = Get-Service -Name AppIDSvc -ErrorAction SilentlyContinue
    if (-not $appIdService) {
        $health.Critical++
        $health.Findings += @{
            Severity = "CRITICAL"
            Category = "Service"
            Issue = "Application Identity service not found"
            Recommendation = "Install AppLocker feature or enable Application Identity service"
        }
    }
    elseif ($appIdService.Status -ne 'Running') {
        $health.Critical++
        $health.Findings += @{
            Severity = "CRITICAL"
            Category = "Service"
            Issue = "Application Identity service is not running (Status: $($appIdService.Status))"
            Recommendation = "Start the Application Identity service: Start-Service AppIDSvc"
        }
    }
    elseif ($appIdService.StartType -ne 'Automatic') {
        $health.Warning++
        $health.Findings += @{
            Severity = "WARNING"
            Category = "Service"
            Issue = "Application Identity service is not set to Automatic startup"
            Recommendation = "Set service to Automatic: Set-Service AppIDSvc -StartupType Automatic"
        }
    }
    else {
        Write-Log "Application Identity service: OK" "SUCCESS"
    }
    
    # Analyze rules by type
    Write-Log "Analyzing rule collections..." "INFO"
    
    $ruleCollections = @('Exe', 'Script', 'MSI', 'DLL', 'PackagedApp')
    $health.Summary.RuleCounts = @{}
    
    foreach ($collection in $ruleCollections) {
        $rules = $xml | Select-Xml -XPath "//RuleCollection[@Type='$collection']//*Rule"
        $count = $rules.Count
        $health.Summary.RuleCounts[$collection] = $count
        Write-Log "$collection rules: $count" "INFO"
    }
    
    # Check for hash rules (maintenance burden)
    Write-Log "Checking hash rules..." "INFO"
    $hashRules = $xml | Select-Xml -XPath "//FileHashRule"
    $hashCount = $hashRules.Count
    $health.Summary.HashRuleCount = $hashCount
    
    if ($hashCount -gt 20) {
        $health.Critical++
        $health.Findings += @{
            Severity = "CRITICAL"
            Category = "Maintenance"
            Issue = "Excessive hash rules ($hashCount) - high maintenance burden"
            Recommendation = "Convert to Publisher rules where possible. Hash rules break on every update."
        }
    }
    elseif ($hashCount -gt 10) {
        $health.Warning++
        $health.Findings += @{
            Severity = "WARNING"
            Category = "Maintenance"
            Issue = "High number of hash rules ($hashCount)"
            Recommendation = "Consider converting to Publisher rules for signed applications"
        }
    }
    elseif ($hashCount -gt 0) {
        $health.Info++
        $health.Findings += @{
            Severity = "INFO"
            Category = "Maintenance"
            Issue = "Hash rules present ($hashCount)"
            Recommendation = "Monitor for update issues. Consider Publisher rules for signed apps."
        }
    }
    
    # Check for dangerous path rules (user-writable locations)
    Write-Log "Checking for dangerous path rules..." "INFO"
    $dangerousPaths = @(
        @{ Path = "%USERPROFILE%"; Description = "User profile directory" },
        @{ Path = "%TEMP%"; Description = "Temporary files" },
        @{ Path = "%APPDATA%"; Description = "Application data" },
        @{ Path = "%LOCALAPPDATA%"; Description = "Local application data" },
        @{ Path = "%USERPROFILE%\Desktop"; Description = "Desktop" },
        @{ Path = "%USERPROFILE%\Downloads"; Description = "Downloads" }
    )
    
    $pathRules = $xml | Select-Xml -XPath "//FilePathRule"
    $dangerousAllowRules = @()
    
    foreach ($rule in $pathRules) {
        $action = $rule.Node.GetAttribute("Action")
        $pathCondition = $rule.Node.SelectSingleNode("Conditions/FilePathCondition")
        
        if ($pathCondition) {
            $path = $pathCondition.GetAttribute("Path")
            
            foreach ($dangerous in $dangerousPaths) {
                if ($path -like "*$($dangerous.Path)*" -and $action -eq "Allow") {
                    $dangerousAllowRules += @{
                        RuleName = $rule.Node.GetAttribute("Name")
                        Path = $path
                        Description = $dangerous.Description
                    }
                }
            }
        }
    }
    
    if ($dangerousAllowRules.Count -gt 0) {
        $health.Critical++
        $health.Findings += @{
            Severity = "CRITICAL"
            Category = "Security"
            Issue = "Allow rules for user-writable locations found ($($dangerousAllowRules.Count))"
            Recommendation = "Remove or convert to Deny rules. User-writable paths are major security risks."
            Details = $dangerousAllowRules
        }
    }
    
    # Check for bypass prevention (deny rules)
    Write-Log "Checking bypass prevention rules..." "INFO"
    $denyRules = $xml | Select-Xml -XPath "//*Rule[@Action='Deny']"
    $denyCount = $denyRules.Count
    $health.Summary.DenyRuleCount = $denyCount
    
    if ($denyCount -eq 0) {
        $health.Warning++
        $health.Findings += @{
            Severity = "WARNING"
            Category = "Security"
            Issue = "No deny rules found - bypass prevention may be insufficient"
            Recommendation = "Add deny rules for user-writable locations (see implementation guide)"
        }
    }
    elseif ($denyCount -lt 5) {
        $health.Info++
        $health.Findings += @{
            Severity = "INFO"
            Category = "Security"
            Issue = "Limited deny rules ($denyCount)"
            Recommendation = "Consider adding more deny rules for common bypass locations"
        }
    }
    
    # Check for default rules (should be removed per STIG)
    Write-Log "Checking for default rules..." "INFO"
    $defaultRuleNames = @("(Default Rule) All files", "Everyone")
    $defaultRulesFound = @()
    
    foreach ($ruleName in $defaultRuleNames) {
        $rules = $xml | Select-Xml -XPath "//*Rule[@Name='$ruleName']"
        if ($rules.Count -gt 0) {
            $defaultRulesFound += $ruleName
        }
    }
    
    if ($defaultRulesFound.Count -gt 0) {
        $health.Critical++
        $health.Findings += @{
            Severity = "CRITICAL"
            Category = "Compliance"
            Issue = "Default AppLocker rules found - violates STIG requirements"
            Recommendation = "Remove default rules and create explicit allow/deny rules"
            Details = $defaultRulesFound
        }
    }
    
    # Check enforcement mode
    Write-Log "Checking enforcement mode..." "INFO"
    $ruleCollections = $xml | Select-Xml -XPath "//RuleCollection"
    $enforcementModes = @()
    
    foreach ($collection in $ruleCollections) {
        $mode = $collection.Node.GetAttribute("EnforcementMode")
        $type = $collection.Node.GetAttribute("Type")
        $enforcementModes += @{
            Type = $type
            Mode = $mode
        }
    }
    
    $health.Summary.EnforcementModes = $enforcementModes
    
    $auditOnly = $enforcementModes | Where-Object { $_.Mode -eq "AuditOnly" }
    $enabled = $enforcementModes | Where-Object { $_.Mode -eq "Enabled" }
    
    if ($auditOnly.Count -gt 0 -and $enabled.Count -eq 0) {
        $health.Info++
        $health.Findings += @{
            Severity = "INFO"
            Category = "Deployment"
            Issue = "All rule collections in AuditOnly mode"
            Recommendation = "Expected for initial deployment. Review audit logs before enabling enforcement."
        }
    }
    
    # Calculate health score
    $health.Score = 100 - (20 * $health.Critical) - (5 * $health.Warning) - (1 * $health.Info)
    if ($health.Score -lt 0) { $health.Score = 0 }
    
    # Determine status
    $health.Status = if ($health.Score -ge 80) { "HEALTHY" }
                     elseif ($health.Score -ge 60) { "WARNING" }
                     elseif ($health.Score -ge 40) { "CRITICAL" }
                     else { "FAILED" }
    
    # Display results
    Write-Log "`n=== HEALTH CHECK RESULTS ===" "INFO"
    Write-Log "Score: $($health.Score)/100" -Level $(if ($health.Score -ge 80) { "SUCCESS" } else { "WARNING" })
    Write-Log "Status: $($health.Status)" -Level $(if ($health.Score -ge 80) { "SUCCESS" } else { "WARNING" })
    Write-Log "Critical Issues: $($health.Critical)" -Level $(if ($health.Critical -eq 0) { "SUCCESS" } else { "CRITICAL" })
    Write-Log "Warnings: $($health.Warning)" -Level $(if ($health.Warning -eq 0) { "SUCCESS" } else { "WARNING" })
    Write-Log "Info: $($health.Info)" "INFO"
    
    if ($health.Findings.Count -gt 0) {
        Write-Log "`n=== FINDINGS ===" "INFO"
        foreach ($finding in $health.Findings) {
            Write-Log "[$($finding.Severity)] $($finding.Category): $($finding.Issue)" -Level $finding.Severity
            Write-Log "  Recommendation: $($finding.Recommendation)" "INFO"
        }
    }
    
    # Export to JSON
    if ($OutputPath) {
        Write-Log "Exporting report to: $OutputPath" "INFO"
        $health | ConvertTo-Json -Depth 10 | Out-File $OutputPath -Encoding UTF8
        Write-Log "Report exported successfully" "SUCCESS"
    }
    
    return $health
}
catch {
    Write-Log "ERROR: $_" "CRITICAL"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "CRITICAL"
    throw
}
