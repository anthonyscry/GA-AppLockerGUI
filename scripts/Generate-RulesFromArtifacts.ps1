# Generate-RulesFromArtifacts.ps1
# GA-ASI Smart Rule Generation from All Scan Artifacts
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Generates AppLocker rules from comprehensive scan artifacts with smart priority.

.DESCRIPTION
    This script processes artifacts from comprehensive scans (JSON format) and generates
    AppLocker rules with priority: Publisher → Hash (Path rules avoided).
    Automatically removes duplicates and handles all artifact types.

.PARAMETER ArtifactsPath
    Path to comprehensive scan artifacts JSON file.

.PARAMETER OutputPath
    Path to save generated policy XML.

.PARAMETER CollectionType
    Rule collection: Exe, Script, MSI, or DLL (default: Exe).

.PARAMETER MergeWithExisting
    Merge with existing policy file.

.PARAMETER ExistingPolicyPath
    Path to existing policy to merge with.

.EXAMPLE
    .\Generate-RulesFromArtifacts.ps1 -ArtifactsPath "C:\Scans\artifacts.json" -OutputPath "C:\Policies\Generated.xml"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path $_ })]
    [string]$ArtifactsPath,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    
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
        if (-not (Test-Path $FilePath)) {
            return $null
        }
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
        if (-not (Test-Path $FilePath)) {
            return $null
        }
        return (Get-FileHash -Path $FilePath -Algorithm SHA256).Hash
    }
    catch {
        return $null
    }
}

try {
    Write-Log "Starting smart rule generation from artifacts..." "INFO"
    
    # Load artifacts JSON
    Write-Log "Loading artifacts from: $ArtifactsPath" "INFO"
    $artifacts = Get-Content $ArtifactsPath | ConvertFrom-Json
    
    # Collect all executables from various artifact sources
    $allExecutables = @()
    
    # From Executables array
    if ($artifacts.Executables) {
        foreach ($exe in $artifacts.Executables) {
            $allExecutables += @{
                Path = $exe.Path
                Name = $exe.Name
                Publisher = $exe.Publisher
                Hash = $exe.Hash
                Source = 'Executables'
            }
        }
    }
    
    # From WritablePaths array
    if ($artifacts.WritablePaths) {
        foreach ($exe in $artifacts.WritablePaths) {
            $allExecutables += @{
                Path = $exe.Path
                Name = $exe.Name
                Publisher = $null
                Hash = $exe.Hash
                Source = 'WritablePaths'
            }
        }
    }
    
    # From EventLogs (extract paths)
    if ($artifacts.EventLogs) {
        foreach ($event in $artifacts.EventLogs) {
            if ($event.Path -and (Test-Path $event.Path)) {
                $allExecutables += @{
                    Path = $event.Path
                    Name = Split-Path $event.Path -Leaf
                    Publisher = $null
                    Hash = $null
                    Source = 'EventLogs'
                }
            }
        }
    }
    
    Write-Log "Collected $($allExecutables.Count) executable references from artifacts" "INFO"
    
    # Remove duplicates by path (keep first occurrence)
    $uniqueExecutables = @{}
    foreach ($exe in $allExecutables) {
        if ($exe.Path -and -not $uniqueExecutables.ContainsKey($exe.Path)) {
            $uniqueExecutables[$exe.Path] = $exe
        }
    }
    
    Write-Log "After deduplication: $($uniqueExecutables.Count) unique executables" "INFO"
    
    # Load existing policy if merging
    $existingPolicy = $null
    if ($MergeWithExisting -and $ExistingPolicyPath -and (Test-Path $ExistingPolicyPath)) {
        Write-Log "Loading existing policy for merge..." "INFO"
        try {
            $existingPolicy = Get-AppLockerPolicy -Xml -Ldap "LDAP://CN={$ExistingPolicyPath}"
        }
        catch {
            # Try loading from file
            $xmlContent = Get-Content $ExistingPolicyPath -Raw
            $existingPolicy = [xml]$xmlContent
        }
    }
    
    # Generate rules with priority: Publisher → Hash
    $rules = @()
    $stats = @{
        Publisher = 0
        Hash = 0
        Skipped = 0
        Errors = 0
        Duplicates = 0
    }
    
    Write-Log "Generating rules with priority: Publisher → Hash..." "INFO"
    
    foreach ($exePath in $uniqueExecutables.Keys) {
        try {
            $exe = $uniqueExecutables[$exePath]
            $filePath = $exe.Path
            $name = $exe.Name
            
            if (-not (Test-Path $filePath)) {
                Write-Log "Skipping $name - file not found: $filePath" "WARNING"
                $stats.Skipped++
                continue
            }
            
            $rule = $null
            
            # PRIORITY 1: Try Publisher rule (preferred - resilient to updates)
            $publisher = $exe.Publisher
            if (-not $publisher) {
                $publisher = Get-FilePublisher -FilePath $filePath
            }
            
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
                }
            }
            
            # PRIORITY 2: Fallback to Hash rule (if Publisher failed or unavailable)
            if (-not $rule) {
                try {
                    $hash = $exe.Hash
                    if (-not $hash) {
                        $hash = Get-FileHash -FilePath $filePath
                    }
                    
                    if ($hash) {
                        $rule = New-GAAppLockerHashRule `
                            -FilePath $filePath `
                            -RuleName ($name -replace '[^\w\-]', '-') `
                            -CollectionType $CollectionType `
                            -ErrorAction SilentlyContinue
                        
                        if ($rule) {
                            $stats.Hash++
                            Write-Log "Created Hash rule for: $name (Publisher unavailable)" "INFO"
                        }
                    }
                }
                catch {
                    Write-Log "Failed to create Hash rule for $name : $_" "WARNING"
                    $stats.Errors++
                }
            }
            
            if ($rule) {
                $rules += $rule
            } else {
                $stats.Skipped++
            }
        }
        catch {
            Write-Log "Error processing $exePath : $_" "WARNING"
            $stats.Errors++
        }
    }
    
    # Merge rules into policy
    Write-Log "Merging $($rules.Count) rules into policy..." "INFO"
    
    if ($rules.Count -eq 0) {
        throw "No rules were generated. Check artifacts file format and file paths."
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
    Write-Log "Total artifact references: $($allExecutables.Count)" "INFO"
    Write-Log "Unique executables: $($uniqueExecutables.Count)" "INFO"
    Write-Log "Publisher rules: $($stats.Publisher) (Preferred)" "INFO"
    Write-Log "Hash rules: $($stats.Hash) (Fallback)" "INFO"
    Write-Log "Skipped: $($stats.Skipped)" "INFO"
    Write-Log "Errors: $($stats.Errors)" "INFO"
    Write-Log "Total rules generated: $($rules.Count)" "INFO"
    Write-Log "Policy saved to: $OutputPath" "SUCCESS"
    
    return @{
        Success = $true
        OutputPath = $OutputPath
        Statistics = $stats
        RulesGenerated = $rules.Count
    }
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    throw
}
