# PowerShell script to setup Windows Server Core as Backup Domain Controller
# This script promotes a server to be a backup DC in an existing domain

$ErrorActionPreference = "Stop"

Write-Host "=== Setting up Windows Backup Domain Controller ===" -ForegroundColor Green

$DomainName = $env:DOMAIN_NAME ?? "applocker.local"
$DomainNetBIOS = $env:DOMAIN_NETBIOS ?? "APPLOCKER"
$DomainAdminPassword = $env:DOMAIN_ADMIN_PASSWORD ?? "SecurePass123!"
$SafeModePassword = $env:SAFE_MODE_PASSWORD ?? "SafeMode123!"
$PrimaryDC = $env:PRIMARY_DC ?? "DC01"

# Convert password to secure string
$SafeModeSecurePassword = ConvertTo-SecureString -String $SafeModePassword -AsPlainText -Force
$DomainCredential = New-Object System.Management.Automation.PSCredential(
    "$DomainNetBIOS\Administrator",
    (ConvertTo-SecureString -String $DomainAdminPassword -AsPlainText -Force)
)

# Install AD DS role
Write-Host "Installing Active Directory Domain Services..." -ForegroundColor Yellow
Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools

# Import AD DS module
Import-Module ADDSDeployment

# Configure DNS to point to primary DC
Write-Host "Configuring DNS..." -ForegroundColor Yellow
$NICs = Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
foreach ($NIC in $NICs) {
    Set-DnsClientServerAddress -InterfaceIndex $NIC.ifIndex -ServerAddresses $PrimaryDC
}

# Wait for primary DC to be ready
Write-Host "Waiting for primary domain controller..." -ForegroundColor Yellow
$MaxRetries = 60
$RetryCount = 0
$PrimaryDCReady = $false

while (-not $PrimaryDCReady -and $RetryCount -lt $MaxRetries) {
    try {
        $TestConnection = Test-Connection -ComputerName $PrimaryDC -Count 1 -ErrorAction SilentlyContinue
        if ($TestConnection) {
            # Test LDAP connectivity
            try {
                $Domain = Get-ADDomain -Server $PrimaryDC -Credential $DomainCredential -ErrorAction Stop
                $PrimaryDCReady = $true
                Write-Host "Primary domain controller is ready!" -ForegroundColor Green
            } catch {
                Write-Host "Waiting for AD DS to be ready... ($RetryCount/$MaxRetries)" -ForegroundColor Yellow
                Start-Sleep -Seconds 5
                $RetryCount++
            }
        } else {
            Write-Host "Waiting for primary DC network connectivity... ($RetryCount/$MaxRetries)" -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            $RetryCount++
        }
    } catch {
        Write-Host "Waiting for primary DC... ($RetryCount/$MaxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        $RetryCount++
    }
}

if (-not $PrimaryDCReady) {
    Write-Host "Warning: Could not reach primary domain controller. Continuing anyway..." -ForegroundColor Red
}

# Check if already a domain controller
$IsDC = (Get-WmiObject Win32_ComputerSystem).PartOfDomain -and (Get-WmiObject Win32_OperatingSystem).ProductType -eq 2

if (-not $IsDC) {
    Write-Host "Promoting server to Backup Domain Controller..." -ForegroundColor Yellow
    
    # Install AD DS as additional domain controller
    try {
        Install-ADDSDomainController `
            -DomainName $DomainName `
            -Credential $DomainCredential `
            -SafeModeAdministratorPassword $SafeModeSecurePassword `
            -InstallDns:$true `
            -DatabasePath "C:\Windows\NTDS" `
            -LogPath "C:\Windows\NTDS" `
            -SysvolPath "C:\Windows\SYSVOL" `
            -NoRebootOnCompletion:$false `
            -Force:$true `
            -SkipPreChecks `
            -WarningAction SilentlyContinue
        
        Write-Host "Backup Domain Controller promotion initiated. Restart may be required." -ForegroundColor Green
    } catch {
        Write-Host "Backup DC promotion failed or already completed: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "Already a domain controller, skipping promotion." -ForegroundColor Green
}

# Wait for AD DS to be ready
Start-Sleep -Seconds 30

# Import AD module
Import-Module ActiveDirectory -ErrorAction SilentlyContinue

# Verify domain controller status
try {
    $DCInfo = Get-ADDomainController -Discover -ErrorAction SilentlyContinue
    Write-Host "Domain Controller Status: $($DCInfo.Name)" -ForegroundColor Green
    Write-Host "Domain: $DomainName" -ForegroundColor Cyan
} catch {
    Write-Host "Could not verify DC status: $_" -ForegroundColor Yellow
}

Write-Host "=== Backup Domain Controller setup complete ===" -ForegroundColor Green

# Run user creation script if it exists
if (Test-Path "C:\scripts\create-users-and-groups.ps1") {
    Write-Host "`nCreating users and groups..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    & "C:\scripts\create-users-and-groups.ps1"
}

# Keep container running
Write-Host "`nBackup Domain Controller is running. Press Ctrl+C to stop." -ForegroundColor Yellow
while ($true) {
    Start-Sleep -Seconds 60
}
