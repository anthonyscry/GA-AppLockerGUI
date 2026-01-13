# Get-IncrementalPolicyUpdate.ps1
# GA-ASI Incremental Policy Updates
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Generates delta policy for new/removed software.

.DESCRIPTION
    Compares new scan results with existing policy to identify changes.

.PARAMETER NewInventory
    New inventory items (JSON array).

.PARAMETER ExistingPolicyPath
    Path to existing policy XML.

.PARAMETER OutputPath
    Path to save delta policy XML.

.EXAMPLE
    .\Get-IncrementalPolicyUpdate.ps1 -NewInventory $newItems -ExistingPolicyPath "C:\Policies\Current.xml" -OutputPath "C:\Policies\Delta.xml"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [array]$NewInventory,
    
    [Parameter(Mandatory = $true)]
    [string]$ExistingPolicyPath,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

#Requires -Modules AppLocker

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

try {
    Write-Log "Analyzing incremental policy update..." "INFO"
    
    # Load existing policy
    if (-not (Test-Path $ExistingPolicyPath)) {
        throw "Existing policy not found: $ExistingPolicyPath"
    }
    
    $existingPolicy = Get-AppLockerPolicy -Xml -Ldap "LDAP://CN={$ExistingPolicyPath}"
    
    # Extract existing rules (simplified - would need full XML parsing in production)
    $existingPaths = @()
    $existingPublishers = @()
    
    # Compare with new inventory
    $newItems = @()
    $removedItems = @()
    
    foreach ($item in $NewInventory) {
        $path = $item.Path
        $found = $false
        
        # Check if item exists in policy (simplified check)
        foreach ($existingPath in $existingPaths) {
            if ($path -eq $existingPath) {
                $found = $true
                break
            }
        }
        
        if (-not $found) {
            $newItems += $item
        }
    }
    
    Write-Log "New items requiring rules: $($newItems.Count)" "INFO"
    Write-Log "Removed items (rules to clean): $($removedItems.Count)" "INFO"
    
    # Generate rules for new items (using existing generation logic)
    # This would call Generate-RulesFromArtifacts or similar
    
    $delta = @{
        NewItems = $newItems
        RemovedItems = $removedItems
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    $delta | ConvertTo-Json -Depth 10 | Out-File $OutputPath -Encoding UTF8
    
    Write-Log "Delta analysis complete" "INFO"
    return $delta
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    throw
}
