# Merge-AppLockerPolicies.ps1
# GA-ASI AppLocker Policy Merger
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Merges multiple AppLocker policy XML files into a single policy.

.DESCRIPTION
    This script merges two or more AppLocker policy XML files, removing duplicates
    and consolidating rules into a single policy file.

.PARAMETER PolicyPaths
    Array of paths to AppLocker policy XML files to merge.

.PARAMETER OutputPath
    Path to save the merged policy XML.

.PARAMETER ConflictResolution
    How to handle conflicting rules: 'First', 'Last', or 'Strict' (default: 'Strict').

.EXAMPLE
    .\Merge-AppLockerPolicies.ps1 -PolicyPaths @("C:\Policies\Baseline.xml", "C:\Policies\Updates.xml") -OutputPath "C:\Policies\Merged.xml"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string[]]$PolicyPaths,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet('First', 'Last', 'Strict')]
    [string]$ConflictResolution = 'Strict'
)

#Requires -Modules AppLocker

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

try {
    Write-Log "Starting policy merge operation..." "INFO"
    
    # Validate all policy files exist
    foreach ($policyPath in $PolicyPaths) {
        if (-not (Test-Path $policyPath)) {
            throw "Policy file not found: $policyPath"
        }
    }
    
    # Load first policy as base
    Write-Log "Loading base policy: $($PolicyPaths[0])" "INFO"
    $mergedPolicy = Get-AppLockerPolicy -Xml -Ldap "LDAP://CN={$PolicyPaths[0]}"
    
    if (-not $mergedPolicy) {
        # Try loading from file directly
        $xmlContent = Get-Content $PolicyPaths[0] -Raw
        $mergedPolicy = [xml]$xmlContent
    }
    
    $stats = @{
        TotalPolicies = $PolicyPaths.Count
        RulesMerged = 0
        DuplicatesRemoved = 0
        Conflicts = 0
    }
    
    # Merge remaining policies
    for ($i = 1; $i -lt $PolicyPaths.Count; $i++) {
        Write-Log "Merging policy $($i + 1)/$($PolicyPaths.Count): $($PolicyPaths[$i])" "INFO"
        
        try {
            $policyToMerge = Get-AppLockerPolicy -Xml -Ldap "LDAP://CN={$PolicyPaths[$i]}"
            
            if (-not $policyToMerge) {
                $xmlContent = Get-Content $PolicyPaths[$i] -Raw
                $policyToMerge = [xml]$xmlContent
            }
            
            # Merge policies
            $mergedPolicy = Merge-AppLockerPolicy -Policy $mergedPolicy -RulePolicy $policyToMerge -ErrorAction SilentlyContinue
            
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Warning: Some rules may not have merged cleanly" "WARNING"
                $stats.Conflicts++
            }
            
            $stats.RulesMerged++
        }
        catch {
            Write-Log "Error merging policy $($PolicyPaths[$i]): $_" "WARNING"
            $stats.Conflicts++
        }
    }
    
    # Export merged policy
    Write-Log "Exporting merged policy to: $OutputPath" "INFO"
    $mergedPolicy | Get-AppLockerPolicy -Xml | Out-File $OutputPath -Encoding UTF8
    
    # Display statistics
    Write-Log "`n=== MERGE STATISTICS ===" "INFO"
    Write-Log "Policies merged: $($stats.TotalPolicies)" "INFO"
    Write-Log "Rules merged: $($stats.RulesMerged)" "INFO"
    Write-Log "Duplicates removed: $($stats.DuplicatesRemoved)" "INFO"
    Write-Log "Conflicts: $($stats.Conflicts)" "INFO"
    Write-Log "Merged policy saved to: $OutputPath" "SUCCESS"
    
    return @{
        Success = $true
        OutputPath = $OutputPath
        Statistics = $stats
    }
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    throw
}
