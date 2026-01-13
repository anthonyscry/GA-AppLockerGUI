# Detect-DuplicateRules.ps1
# GA-ASI Smart Duplicate Detection
# Version: 1.2.4
# Author: GA-ASI ISSO Team

<#
.SYNOPSIS
    Detects duplicate rules across policies and inventory.

.DESCRIPTION
    Identifies duplicates by path, hash, and publisher+name combinations.

.PARAMETER InventoryItems
    Array of inventory items to check.

.PARAMETER PolicyPath
    Optional: Path to existing policy to check against.

.PARAMETER OutputPath
    Path to save duplicate report JSON.

.EXAMPLE
    .\Detect-DuplicateRules.ps1 -InventoryItems $items -OutputPath "C:\Reports\duplicates.json"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [array]$InventoryItems,
    
    [Parameter(Mandatory = $false)]
    [string]$PolicyPath,
    
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$timestamp] [$Level] $Message"
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
    Write-Log "Detecting duplicates..." "INFO"
    
    $duplicates = @{
        ByPath = @{}
        ByHash = @{}
        ByPublisherName = @{}
    }
    
    $hashes = @{}
    $paths = @{}
    $publisherNames = @{}
    
    foreach ($item in $InventoryItems) {
        $path = $item.Path
        $name = $item.Name
        $publisher = $item.Publisher
        
        # Check by path
        if ($path -and $paths.ContainsKey($path)) {
            if (-not $duplicates.ByPath.ContainsKey($path)) {
                $duplicates.ByPath[$path] = @()
            }
            $duplicates.ByPath[$path] += $item
        } else {
            $paths[$path] = $item
        }
        
        # Check by hash
        if ($path -and (Test-Path $path)) {
            $hash = Get-FileHash -FilePath $path
            if ($hash) {
                if ($hashes.ContainsKey($hash)) {
                    if (-not $duplicates.ByHash.ContainsKey($hash)) {
                        $duplicates.ByHash[$hash] = @()
                    }
                    $duplicates.ByHash[$hash] += $item
                } else {
                    $hashes[$hash] = $item
                }
            }
        }
        
        # Check by publisher + name
        if ($publisher -and $name) {
            $key = "$publisher|$name"
            if ($publisherNames.ContainsKey($key)) {
                if (-not $duplicates.ByPublisherName.ContainsKey($key)) {
                    $duplicates.ByPublisherName[$key] = @()
                }
                $duplicates.ByPublisherName[$key] += $item
            } else {
                $publisherNames[$key] = $item
            }
        }
    }
    
    $report = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        TotalItems = $InventoryItems.Count
        DuplicatesByPath = $duplicates.ByPath.Count
        DuplicatesByHash = $duplicates.ByHash.Count
        DuplicatesByPublisherName = $duplicates.ByPublisherName.Count
        Details = $duplicates
    }
    
    $report | ConvertTo-Json -Depth 10 | Out-File $OutputPath -Encoding UTF8
    
    Write-Log "Duplicate detection complete" "INFO"
    Write-Log "Duplicates by path: $($duplicates.ByPath.Count)" "INFO"
    Write-Log "Duplicates by hash: $($duplicates.ByHash.Count)" "INFO"
    Write-Log "Duplicates by publisher+name: $($duplicates.ByPublisherName.Count)" "INFO"
    
    return $report
}
catch {
    Write-Log "ERROR: $_" "ERROR"
    throw
}
