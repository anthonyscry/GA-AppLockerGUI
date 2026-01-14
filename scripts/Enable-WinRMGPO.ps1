<#
.SYNOPSIS
    Enables WinRM domain-wide via Group Policy Object.

.DESCRIPTION
    Creates or updates a GPO to enable Windows Remote Management (WinRM)
    across the domain for remote AppLocker management and scanning.

.NOTES
    Requires: GroupPolicy PowerShell module, Domain Admin privileges
    Author: GA-ASI AppLocker Toolkit
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$GPOName = "Enable-WinRM",

    [Parameter()]
    [string]$Comment = "Enables WinRM for AppLocker remote management",

    [Parameter()]
    [string]$TargetOU = $null
)

$ErrorActionPreference = "Stop"

try {
    # Import GroupPolicy module
    Import-Module GroupPolicy -ErrorAction Stop

    Write-Host "Checking for existing GPO: $GPOName" -ForegroundColor Cyan

    # Check if GPO already exists
    $gpo = Get-GPO -Name $GPOName -ErrorAction SilentlyContinue

    if (-not $gpo) {
        Write-Host "Creating new GPO: $GPOName" -ForegroundColor Yellow
        $gpo = New-GPO -Name $GPOName -Comment $Comment
        Write-Host "GPO created successfully" -ForegroundColor Green
    } else {
        Write-Host "GPO already exists, updating settings..." -ForegroundColor Yellow
    }

    # Configure WinRM Service settings
    Write-Host "Configuring WinRM service settings..." -ForegroundColor Cyan

    # Enable WinRM service
    Set-GPRegistryValue -Name $GPOName `
        -Key "HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service" `
        -ValueName "AllowAutoConfig" `
        -Type DWord `
        -Value 1

    # Set IPv4 filter to allow all
    Set-GPRegistryValue -Name $GPOName `
        -Key "HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service" `
        -ValueName "IPv4Filter" `
        -Type String `
        -Value "*"

    # Set IPv6 filter to allow all
    Set-GPRegistryValue -Name $GPOName `
        -Key "HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service" `
        -ValueName "IPv6Filter" `
        -Type String `
        -Value "*"

    # Allow remote server management through WinRM
    Set-GPRegistryValue -Name $GPOName `
        -Key "HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service" `
        -ValueName "AllowRemoteShellAccess" `
        -Type DWord `
        -Value 1

    # Configure Windows Firewall to allow WinRM
    Write-Host "Configuring firewall rules..." -ForegroundColor Cyan

    Set-GPRegistryValue -Name $GPOName `
        -Key "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\FirewallRules" `
        -ValueName "WINRM-HTTP-In-TCP" `
        -Type String `
        -Value "v2.31|Action=Allow|Active=TRUE|Dir=In|Protocol=6|LPort=5985|App=System|Name=Windows Remote Management (HTTP-In)|"

    # Enable GPO (ensure it's not disabled)
    $gpo.GpoStatus = "AllSettingsEnabled"

    # Get the domain root DN if no target specified
    if (-not $TargetOU) {
        $TargetOU = (Get-ADDomain).DistinguishedName
        Write-Host "No target OU specified, linking to domain root: $TargetOU" -ForegroundColor Yellow
    }

    # Link GPO to target (root domain or specified OU)
    Write-Host "Linking GPO to: $TargetOU" -ForegroundColor Cyan

    # Check if link already exists
    $existingLink = Get-GPInheritance -Target $TargetOU -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty GpoLinks |
        Where-Object { $_.DisplayName -eq $GPOName }

    if (-not $existingLink) {
        New-GPLink -Name $GPOName -Target $TargetOU -LinkEnabled Yes -ErrorAction Stop
        Write-Host "GPO linked successfully to $TargetOU" -ForegroundColor Green
    } else {
        Write-Host "GPO link already exists at $TargetOU" -ForegroundColor Yellow
    }

    Write-Host "`nWinRM GPO enabled successfully!" -ForegroundColor Green
    Write-Host "GPO Name: $GPOName" -ForegroundColor White
    Write-Host "Status: Enabled" -ForegroundColor White
    Write-Host "`nNote: Run 'gpupdate /force' on target machines or wait for Group Policy refresh." -ForegroundColor Yellow

    # Return success object
    @{
        success = $true
        gpoName = $GPOName
        gpoId = $gpo.Id.ToString()
        status = "Enabled"
    } | ConvertTo-Json -Compress

} catch {
    Write-Error "Failed to enable WinRM GPO: $_"
    @{
        success = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
    exit 1
}
