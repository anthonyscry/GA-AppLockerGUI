# Generate-BatchRules.ps1
# GA-ASI Batch Rule Generation
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Generates AppLocker rules in batch from inventory with smart priority.

.DESCRIPTION
    Processes multiple inventory items and generates rules with Publisher → Hash priority.
    Automatically groups by publisher when possible.

.PARAMETER InventoryItems
    Array of inventory items (from JSON).

.PARAMETER OutputPath
    Path to save generated policy XML.

.PARAMETER RuleAction
    Action: Allow or Deny (default: Allow).

.PARAMETER TargetGroup
    AD security group for rules.

.PARAMETER CollectionType
    Rule collection: Exe, Script, MSI, or DLL (default: Exe).

.PARAMETER GroupByPublisher
    Group items by publisher to create single rules (default: true).

.EXAMPLE
    .\Generate-BatchRules.ps1 -InventoryItems $items -OutputPath "C:\Policies\Batch.xml"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [array]$InventoryItems,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet('Allow', 'Deny')]
    [string]$RuleAction = 'Allow',
    
    [Parameter(Mandatory = $false)]
    [string]$TargetGroup = 'AppLocker-WS-Audit',
    
    [Parameter(Mandatory = $false)]
    [ValidateSet('Exe', 'Script', 'MSI', 'DLL')]
    [string]$CollectionType = 'Exe',
    
    [Parameter(Mandatory = $false)]
    [switch]$GroupByPublisher = $true
)

#Requires -Modules AppLocker, GA-AppLocker

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

function Get-FilePublisher {
    param([string]$FilePath)
    try {
        if (-not (Test-Path $FilePath)) { return $null }
        $sig = Get-AuthenticodeSignature -FilePath $FilePath -ErrorAction SilentlyContinue
        if ($sig -and $sig.Status -eq 'Valid') {
            return $sig.SignerCertificate.Subject
        }
    }
    catch { }
    return $null
}

function Get-FileHash {
    param([string]$FilePath)
    try {
        if (-not (Test-Path $FilePath)) { return $null }
        return (Get-FileHash -Path $FilePath -Algorithm SHA256).Hash
    }
    catch { return $null }
}

try {
    Write-Log "Starting batch rule generation for $($InventoryItems.Count) items..." "INFO"
    
    $rules = @()
    $stats = @{
        Publisher = 0
        PublisherGrouped = 0
        Hash = 0
        Skipped = 0
        Errors = 0
        Duplicates = 0
    }

    # Remove duplicates by path before processing
    $uniqueInventory = @()
    $seenPaths = @{}
    foreach ($item in $InventoryItems) {
        $pathValue = $item.Path
        if ($pathValue) {
            $key = $pathValue.ToLower()
            if ($seenPaths.ContainsKey($key)) {
                $stats.Duplicates++
                continue
            }
            $seenPaths[$key] = $true
        }
        $uniqueInventory += $item
    }

    Write-Log "After deduplication: $($uniqueInventory.Count) unique items" "INFO"
    
    # Group by publisher if enabled
    if ($GroupByPublisher) {
        Write-Log "Grouping items by publisher..." "INFO"
        $publisherGroups = @{}
        
        foreach ($item in $uniqueInventory) {
            $filePath = $item.Path
            if (-not $filePath -or -not (Test-Path $filePath)) {
                $stats.Skipped++
                continue
            }
            
            $publisher = $item.Publisher
            if (-not $publisher -or $publisher -eq 'Unknown') {
                $publisher = Get-FilePublisher -FilePath $filePath
            }
            
            if ($publisher) {
                # Extract publisher name
                if ($publisher -match "O=([^,]+)") {
                    $pubName = "O=$($matches[1])*"
                } else {
                    $pubName = $publisher
                }
                
                if (-not $publisherGroups.ContainsKey($pubName)) {
                    $publisherGroups[$pubName] = @()
                }
                $publisherGroups[$pubName] += $item
            }
        }
        
        # Create Publisher rules for grouped items
        foreach ($pubName in $publisherGroups.Keys) {
            $items = $publisherGroups[$pubName]
            try {
                $rule = New-GAAppLockerPublisherRule `
                    -PublisherName $pubName `
                    -RuleName "Batch-$($pubName -replace '[^\w\-]', '-')" `
                    -CollectionType $CollectionType `
                    -Action $RuleAction `
                    -ErrorAction SilentlyContinue
                
                if ($rule) {
                    $rules += $rule
                    $stats.PublisherGrouped++
                    $stats.Publisher += $items.Count
                    Write-Log "Created Publisher rule for $($items.Count) items from $pubName" "INFO"
                }
            }
            catch {
                Write-Log "Failed to create Publisher rule for $pubName : $_" "WARNING"
                $stats.Errors++
            }
        }
    }
    
    # Process remaining items (those without publishers or not grouped)
    $processedPaths = @{}
    foreach ($item in $uniqueInventory) {
        $filePath = $item.Path
        if (-not $filePath -or -not (Test-Path $filePath) -or $processedPaths.ContainsKey($filePath)) {
            continue
        }
        
        $processedPaths[$filePath] = $true
        
        # Skip if already in a publisher group
        $publisher = $item.Publisher
        if (-not $publisher -or $publisher -eq 'Unknown') {
            $publisher = Get-FilePublisher -FilePath $filePath
        }
        
        if ($publisher -and $GroupByPublisher) {
            # Already handled by publisher grouping
            continue
        }
        
        # Try Publisher first
        if ($publisher) {
            try {
                if ($publisher -match "O=([^,]+)") {
                    $pubName = "O=$($matches[1])*"
                } else {
                    $pubName = $publisher
                }
                
                $rule = New-GAAppLockerPublisherRule `
                    -PublisherName $pubName `
                    -RuleName ($item.Name -replace '[^\w\-]', '-') `
                    -CollectionType $CollectionType `
                    -Action $RuleAction `
                    -ErrorAction SilentlyContinue
                
                if ($rule) {
                    $rules += $rule
                    $stats.Publisher++
                    Write-Log "Created Publisher rule for: $($item.Name)" "INFO"
                    continue
                }
            }
            catch {
                Write-Log "Publisher rule failed for $($item.Name), trying Hash..." "WARNING"
            }
        }
        
        # Fallback to Hash
        try {
            $hash = Get-FileHash -FilePath $filePath
            if ($hash) {
                $rule = New-GAAppLockerHashRule `
                    -FilePath $filePath `
                    -RuleName ($item.Name -replace '[^\w\-]', '-') `
                    -CollectionType $CollectionType `
                    -Action $RuleAction `
                    -ErrorAction SilentlyContinue
                
                if ($rule) {
                    $rules += $rule
                    $stats.Hash++
                    Write-Log "Created Hash rule for: $($item.Name)" "INFO"
                }
            } else {
                $stats.Skipped++
            }
        }
        catch {
            Write-Log "Failed to create Hash rule for $($item.Name) : $_" "WARNING"
            $stats.Errors++
        }
    }
    
    # Merge rules into policy
    if ($rules.Count -eq 0) {
        throw "No rules were generated."
    }
    
    Write-Log "Merging $($rules.Count) rules into policy..." "INFO"
    $policy = $rules[0]
    
    for ($i = 1; $i -lt $rules.Count; $i++) {
        try {
            $policy = Merge-AppLockerPolicy -Policy $policy -RulePolicy $rules[$i] -ErrorAction SilentlyContinue
        }
        catch {
            Write-Log "Could not merge rule $i" "WARNING"
        }
    }
    
    # Export policy
    Write-Log "Exporting policy to: $OutputPath" "INFO"
    $policy | Get-AppLockerPolicy -Xml | Out-File $OutputPath -Encoding UTF8
    
    Write-Log "`n=== BATCH GENERATION STATISTICS ===" "INFO"
    Write-Log "Total items: $($InventoryItems.Count)" "INFO"
    Write-Log "Duplicates removed: $($stats.Duplicates)" "INFO"
    Write-Log "Publisher rules (individual): $($stats.Publisher)" "INFO"
    Write-Log "Publisher rules (grouped): $($stats.PublisherGrouped)" "INFO"
    Write-Log "Hash rules: $($stats.Hash)" "INFO"
    Write-Log "Skipped: $($stats.Skipped)" "INFO"
    Write-Log "Errors: $($stats.Errors)" "INFO"
    Write-Log "Total rules generated: $($rules.Count)" "INFO"
    
    return @{
        Success = $true
        OutputPath = $OutputPath
        Statistics = $stats
        RulesGenerated = $rules.Count
    }
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    throw
}
