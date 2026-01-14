<#
.SYNOPSIS
    Disables WinRM GPO domain-wide.

.DESCRIPTION
    Creates a GPO to disable Windows Remote Management (WinRM)
    across the domain, or disables/removes an existing Enable-WinRM GPO.

.NOTES
    Requires: GroupPolicy PowerShell module, Domain Admin privileges
    Author: GA-ASI AppLocker Toolkit
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$GPOName = "Disable-WinRM",

    [Parameter()]
    [string]$EnableGPOName = "Enable-WinRM",

    [Parameter()]
    [switch]$RemoveEnableGPO = $false,

    [Parameter()]
    [string]$Comment = "Disables WinRM for security lockdown"
)

$ErrorActionPreference = "Stop"

try {
    # Import GroupPolicy module
    Import-Module GroupPolicy -ErrorAction Stop
    Import-Module ActiveDirectory -ErrorAction Stop

    $domainDN = (Get-ADDomain).DistinguishedName

    # First, handle any existing Enable-WinRM GPO
    $enableGpo = Get-GPO -Name $EnableGPOName -ErrorAction SilentlyContinue
    if ($enableGpo) {
        Write-Host "Found existing Enable-WinRM GPO, disabling it..." -ForegroundColor Yellow

        # Disable the enable GPO
        $enableGpo.GpoStatus = "AllSettingsDisabled"

        # Remove all links
        $links = Get-GPInheritance -Target $domainDN -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty GpoLinks |
            Where-Object { $_.DisplayName -eq $EnableGPOName }

        foreach ($link in $links) {
            Remove-GPLink -Name $EnableGPOName -Target $link.Target -ErrorAction SilentlyContinue
            Write-Host "Removed GPO link from: $($link.Target)" -ForegroundColor Yellow
        }

        if ($RemoveEnableGPO) {
            Remove-GPO -Name $EnableGPOName -Confirm:$false -ErrorAction SilentlyContinue
            Write-Host "Removed Enable-WinRM GPO completely" -ForegroundColor Red
        }
    }

    # Now create or update the Disable-WinRM GPO
    Write-Host "Checking for Disable-WinRM GPO: $GPOName" -ForegroundColor Cyan
    $gpo = Get-GPO -Name $GPOName -ErrorAction SilentlyContinue

    if (-not $gpo) {
        Write-Host "Creating new GPO: $GPOName" -ForegroundColor Yellow
        $gpo = New-GPO -Name $GPOName -Comment $Comment
        Write-Host "GPO created successfully" -ForegroundColor Green
    } else {
        Write-Host "GPO already exists, updating settings..." -ForegroundColor Yellow
    }

    # Configure WinRM Service to be disabled
    Write-Host "Configuring WinRM service settings to DISABLE..." -ForegroundColor Cyan

    # Disable WinRM auto-config
    Set-GPRegistryValue -Name $GPOName `
        -Key "HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service" `
        -ValueName "AllowAutoConfig" `
        -Type DWord `
        -Value 0

    # Disable remote shell access
    Set-GPRegistryValue -Name $GPOName `
        -Key "HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service" `
        -ValueName "AllowRemoteShellAccess" `
        -Type DWord `
        -Value 0

    # Enable GPO (ensure it's not disabled)
    $gpo.GpoStatus = "AllSettingsEnabled"

    # Link to domain root
    Write-Host "Linking GPO to domain root: $domainDN" -ForegroundColor Cyan

    # Check if link already exists
    $existingLink = Get-GPInheritance -Target $domainDN -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty GpoLinks |
        Where-Object { $_.DisplayName -eq $GPOName }

    if (-not $existingLink) {
        New-GPLink -Name $GPOName -Target $domainDN -LinkEnabled Yes -ErrorAction Stop
        Write-Host "GPO linked successfully to domain root" -ForegroundColor Green
    } else {
        Write-Host "GPO link already exists at domain root" -ForegroundColor Yellow
    }

    Write-Host "`nWinRM GPO disabled successfully!" -ForegroundColor Green
    Write-Host "GPO Name: $GPOName" -ForegroundColor White
    Write-Host "Status: Enabled (disables WinRM)" -ForegroundColor White
    Write-Host "`nNote: Run 'gpupdate /force' on target machines or wait for Group Policy refresh." -ForegroundColor Yellow

    @{
        success = $true
        status = "Disabled"
        gpoName = $GPOName
        gpoId = $gpo.Id.ToString()
    } | ConvertTo-Json -Compress

} catch {
    Write-Error "Failed to disable WinRM GPO: $_"
    @{
        success = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
    exit 1
}
