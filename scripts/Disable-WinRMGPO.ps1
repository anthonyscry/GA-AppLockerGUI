<#
.SYNOPSIS
    Disables WinRM GPO domain-wide.

.DESCRIPTION
    Disables the WinRM Group Policy Object to stop remote management
    capabilities across the domain.

.NOTES
    Requires: GroupPolicy PowerShell module, Domain Admin privileges
    Author: GA-ASI AppLocker Toolkit
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$GPOName = "Enable-WinRM",

    [Parameter()]
    [switch]$RemoveGPO = $false
)

$ErrorActionPreference = "Stop"

try {
    # Import GroupPolicy module
    Import-Module GroupPolicy -ErrorAction Stop

    Write-Host "Looking for GPO: $GPOName" -ForegroundColor Cyan

    # Check if GPO exists
    $gpo = Get-GPO -Name $GPOName -ErrorAction SilentlyContinue

    if (-not $gpo) {
        Write-Host "GPO not found: $GPOName" -ForegroundColor Yellow
        @{
            success = $true
            status = "NotFound"
            message = "GPO does not exist"
        } | ConvertTo-Json -Compress
        exit 0
    }

    if ($RemoveGPO) {
        # Completely remove the GPO
        Write-Host "Removing GPO: $GPOName" -ForegroundColor Red

        # Remove all links first
        $links = Get-GPInheritance -Target (Get-ADDomain).DistinguishedName |
            Select-Object -ExpandProperty GpoLinks |
            Where-Object { $_.DisplayName -eq $GPOName }

        foreach ($link in $links) {
            Remove-GPLink -Name $GPOName -Target $link.Target -ErrorAction SilentlyContinue
        }

        # Remove the GPO
        Remove-GPO -Name $GPOName -Confirm:$false

        Write-Host "GPO removed successfully" -ForegroundColor Green

        @{
            success = $true
            status = "Removed"
            gpoName = $GPOName
        } | ConvertTo-Json -Compress

    } else {
        # Just disable the GPO (safer option)
        Write-Host "Disabling GPO: $GPOName" -ForegroundColor Yellow

        $gpo.GpoStatus = "AllSettingsDisabled"

        Write-Host "GPO disabled successfully" -ForegroundColor Green
        Write-Host "`nNote: Run 'gpupdate /force' on target machines or wait for Group Policy refresh." -ForegroundColor Yellow

        @{
            success = $true
            status = "Disabled"
            gpoName = $GPOName
            gpoId = $gpo.Id.ToString()
        } | ConvertTo-Json -Compress
    }

} catch {
    Write-Error "Failed to disable WinRM GPO: $_"
    @{
        success = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
    exit 1
}
