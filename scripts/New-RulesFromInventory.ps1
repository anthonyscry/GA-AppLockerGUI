# New-RulesFromInventory.ps1
# GA-ASI AppLocker Rule Generation from Inventory
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Generates AppLocker rules from software inventory scan results.

.DESCRIPTION
    This script processes inventory data (from remote scans or CSV) and generates
    appropriate AppLocker rules (Publisher preferred, Hash/Path as fallback).

.PARAMETER InventoryPath
    Path to inventory CSV file or JSON file.

.PARAMETER OutputPath
    Path to save generated policy XML.

.PARAMETER RuleType
    Preferred rule type: Publisher, Path, or Hash (default: Auto - tries Publisher first).

.PARAMETER CollectionType
    Rule collection: Exe, Script, MSI, or DLL (default: Exe).

.PARAMETER MergeWithExisting
    Merge with existing policy file.

.PARAMETER ExistingPolicyPath
    Path to existing policy to merge with.

.EXAMPLE
    .\New-RulesFromInventory.ps1 -InventoryPath "C:\Scans\inventory.csv" -OutputPath "C:\Policies\Generated.xml"

.EXAMPLE
    .\New-RulesFromInventory.ps1 -InventoryPath "C:\Scans\inventory.csv" -OutputPath "C:\Policies\Generated.xml" -MergeWithExisting -ExistingPolicyPath "C:\Policies\Baseline.xml"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path $_ })]
    [string]$InventoryPath,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet('Auto', 'Publisher', 'Path', 'Hash')]
    [string]$RuleType = 'Auto',
    
    [Parameter(Mandatory = $false)]
    [ValidateSet('Exe', 'Script', 'MSI', 'DLL')]
    [string]$CollectionType = 'Exe',
    
    [Parameter(Mandatory = $false)]
    [switch]$MergeWithExisting,
    
    [Parameter(Mandatory = $false)]
    [string]$ExistingPolicyPath
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

try {
    Write-Log "Starting rule generation from inventory..." "INFO"
    
    # Import GA-AppLocker module if available
    $modulePath = Join-Path $PSScriptRoot "GA-AppLocker.psm1"
    if (Test-Path $modulePath) {
        Import-Module $modulePath -Force
        Write-Log "GA-AppLocker module loaded" "INFO"
    }
    
    # Load inventory
    Write-Log "Loading inventory from: $InventoryPath" "INFO"
    
    $extension = [System.IO.Path]::GetExtension($InventoryPath).ToLower()
    $inventory = @()
    
    if ($extension -eq '.csv') {
        $inventory = Import-Csv -Path $InventoryPath
    }
    elseif ($extension -eq '.json') {
        $inventory = Get-Content $InventoryPath | ConvertFrom-Json
    }
    else {
        throw "Unsupported inventory format. Use CSV or JSON."
    }
    
    Write-Log "Loaded $($inventory.Count) inventory items" "INFO"
    
    # Load existing policy if merging
    $existingPolicy = $null
    if ($MergeWithExisting -and $ExistingPolicyPath -and (Test-Path $ExistingPolicyPath)) {
        Write-Log "Loading existing policy for merge..." "INFO"
        $existingPolicy = Get-AppLockerPolicy -Xml -Ldap "LDAP://CN={$ExistingPolicyPath}"
    }
    
    # Generate rules
    $rules = @()
    $stats = @{
        Publisher = 0
        Path = 0
        Hash = 0
        Skipped = 0
        Errors = 0
    }
    
    Write-Log "Generating rules..." "INFO"
    
    foreach ($item in $inventory) {
        try {
            $filePath = $item.Path
            $name = $item.Name
            $publisher = $item.Publisher
            
            if (-not $filePath -or -not (Test-Path $filePath)) {
                Write-Log "Skipping $name - file not found: $filePath" "WARNING"
                $stats.Skipped++
                continue
            }
            
            # Determine rule type with priority: Publisher → Hash (skip Path)
            $selectedRuleType = $RuleType
            if ($RuleType -eq 'Auto') {
                # PRIORITY 1: Try to get publisher from file (preferred - resilient to updates)
                $filePublisher = Get-FilePublisher -FilePath $filePath
                if ($filePublisher) {
                    $selectedRuleType = 'Publisher'
                    $publisher = $filePublisher
                }
                else {
                    # PRIORITY 2: Use Hash rule (most secure for unsigned files)
                    # Skip Path rules - they're too restrictive and break on updates
                    $selectedRuleType = 'Hash'
                }
            }
            
            # Generate rule based on type
            $rule = $null
            
            switch ($selectedRuleType) {
                'Publisher' {
                    if ($publisher) {
                        try {
                            # Extract publisher name from certificate subject
                            $publisherName = $publisher
                            if ($publisher -match "O=([^,]+)") {
                                $publisherName = "O=$($matches[1])*"
                            }
                            
                            $rule = New-GAAppLockerPublisherRule `
                                -PublisherName $publisherName `
                                -RuleName ($name -replace '[^\w\-]', '-') `
                                -CollectionType $CollectionType `
                                -ErrorAction SilentlyContinue
                            
                            if ($rule) {
                                $stats.Publisher++
                                Write-Log "Created Publisher rule for: $name" "INFO"
                            }
                        }
                        catch {
                            Write-Log "Failed to create Publisher rule for $name : $_" "WARNING"
                            $stats.Errors++
                        }
                    }
                }
                
                'Path' {
                    try {
                        # Normalize path
                        $normalizedPath = $filePath
                        if ($filePath -like "C:\Program Files*") {
                            $normalizedPath = "%PROGRAMFILES%\*"
                        }
                        elseif ($filePath -like "C:\Program Files (x86)*") {
                            $normalizedPath = "%PROGRAMFILES(X86)%\*"
                        }
                        elseif ($filePath -like "C:\Windows*") {
                            $normalizedPath = "%WINDIR%\*"
                        }
                        else {
                            # Use directory path
                            $dir = Split-Path $filePath -Parent
                            $normalizedPath = "$dir\*"
                        }
                        
                        $rule = New-GAAppLockerPathRule `
                            -Path $normalizedPath `
                            -RuleName ($name -replace '[^\w\-]', '-') `
                            -CollectionType $CollectionType `
                            -ErrorAction SilentlyContinue
                        
                        if ($rule) {
                            $stats.Path++
                            Write-Log "Created Path rule for: $name" "INFO"
                        }
                    }
                    catch {
                        Write-Log "Failed to create Path rule for $name : $_" "WARNING"
                        $stats.Errors++
                    }
                }
                
                'Hash' {
                    try {
                        $rule = New-GAAppLockerHashRule `
                            -FilePath $filePath `
                            -RuleName ($name -replace '[^\w\-]', '-') `
                            -CollectionType $CollectionType `
                            -ErrorAction SilentlyContinue
                        
                        if ($rule) {
                            $stats.Hash++
                            Write-Log "Created Hash rule for: $name" "INFO"
                        }
                    }
                    catch {
                        Write-Log "Failed to create Hash rule for $name : $_" "WARNING"
                        $stats.Errors++
                    }
                }
            }
            
            if ($rule) {
                $rules += $rule
            }
        }
        catch {
            Write-Log "Error processing inventory item: $_" "WARNING"
            $stats.Errors++
        }
    }
    
    # Merge rules into policy
    Write-Log "Merging rules into policy..." "INFO"
    
    if ($rules.Count -eq 0) {
        throw "No rules were generated. Check inventory file format and file paths."
    }
    
    # Create new policy from first rule
    $policy = $rules[0]
    
    # Merge remaining rules
    for ($i = 1; $i -lt $rules.Count; $i++) {
        try {
            $policy = Merge-AppLockerPolicy -Policy $policy -RulePolicy $rules[$i] -ErrorAction SilentlyContinue
        }
        catch {
            Write-Log "Could not merge rule $i, continuing..." "WARNING"
        }
    }
    
    # Merge with existing policy if specified
    if ($existingPolicy) {
        Write-Log "Merging with existing policy..." "INFO"
        try {
            $policy = Merge-AppLockerPolicy -Policy $existingPolicy -RulePolicy $policy
        }
        catch {
            Write-Log "Could not merge with existing policy: $_" "WARNING"
        }
    }
    
    # Export policy
    Write-Log "Exporting policy to: $OutputPath" "INFO"
    $policy | Get-AppLockerPolicy -Xml | Out-File $OutputPath -Encoding UTF8
    
    # Display statistics
    Write-Log "`n=== GENERATION STATISTICS ===" "INFO"
    Write-Log "Total inventory items: $($inventory.Count)" "INFO"
    Write-Log "Publisher rules: $($stats.Publisher)" "INFO"
    Write-Log "Path rules: $($stats.Path)" "INFO"
    Write-Log "Hash rules: $($stats.Hash)" "INFO"
    Write-Log "Skipped: $($stats.Skipped)" "INFO"
    Write-Log "Errors: $($stats.Errors)" "INFO"
    Write-Log "Total rules generated: $($rules.Count)" "INFO"
    Write-Log "Policy saved to: $OutputPath" "SUCCESS"
    
    return $policy
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    throw
}
