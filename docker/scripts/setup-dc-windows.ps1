# PowerShell script to setup Windows Server Core as Domain Controller
# This script configures AD DS on Windows Server Core container

$ErrorActionPreference = "Stop"

Write-Host "=== Setting up Windows Active Directory Domain Controller ===" -ForegroundColor Green

$DomainName = $env:DOMAIN_NAME ?? "applocker.local"
$DomainNetBIOS = $env:DOMAIN_NETBIOS ?? "APPLOCKER"
$DomainAdminPassword = $env:DOMAIN_ADMIN_PASSWORD ?? "SecurePass123!"
$SafeModePassword = $env:SAFE_MODE_PASSWORD ?? "SafeMode123!"

# Convert password to secure string
$SecurePassword = ConvertTo-SecureString -String $DomainAdminPassword -AsPlainText -Force
$SafeModeSecurePassword = ConvertTo-SecureString -String $SafeModePassword -AsPlainText -Force

# Install AD DS role
Write-Host "Installing Active Directory Domain Services..." -ForegroundColor Yellow
Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools

# Import AD DS module
Import-Module ADDSDeployment

# Check if domain already exists
$DomainExists = Get-ADDomain -ErrorAction SilentlyContinue

if (-not $DomainExists) {
    Write-Host "Promoting server to Domain Controller..." -ForegroundColor Yellow
    
    # Install AD DS forest
    Install-ADDSForest `
        -CreateDnsDelegation:$false `
        -DatabasePath "C:\Windows\NTDS" `
        -DomainMode "Win2012R2" `
        -DomainName $DomainName `
        -DomainNetbiosName $DomainNetBIOS `
        -ForestMode "Win2012R2" `
        -InstallDns:$true `
        -LogPath "C:\Windows\NTDS" `
        -NoRebootOnCompletion:$false `
        -SysvolPath "C:\Windows\SYSVOL" `
        -Force:$true `
        -SafeModeAdministratorPassword $SafeModeSecurePassword `
        -SkipPreChecks `
        -WarningAction SilentlyContinue
} else {
    Write-Host "Domain already exists, skipping promotion." -ForegroundColor Green
}

# Wait for AD DS to be ready
Start-Sleep -Seconds 30

# Import AD module
Import-Module ActiveDirectory -ErrorAction SilentlyContinue

# Create test users
Write-Host "Creating test users..." -ForegroundColor Yellow
$Users = @(
    @{Name="testuser1"; Password="TestUser1@123"},
    @{Name="testuser2"; Password="TestUser2@123"}
)

foreach ($User in $Users) {
    try {
        $UserExists = Get-ADUser -Identity $User.Name -ErrorAction SilentlyContinue
        if (-not $UserExists) {
            $UserPassword = ConvertTo-SecureString -String $User.Password -AsPlainText -Force
            New-ADUser `
                -Name $User.Name `
                -SamAccountName $User.Name `
                -UserPrincipalName "$($User.Name)@$DomainName" `
                -AccountPassword $UserPassword `
                -Enabled $true `
                -PasswordNeverExpires $true `
                -ErrorAction SilentlyContinue
            Write-Host "Created user: $($User.Name)" -ForegroundColor Green
        }
    } catch {
        Write-Host "User $($User.Name) may already exist or error: $_" -ForegroundColor Yellow
    }
}

# Create test groups
Write-Host "Creating test groups..." -ForegroundColor Yellow
$Groups = @("AppLocker-Users", "AppLocker-Admins")

foreach ($Group in $Groups) {
    try {
        $GroupExists = Get-ADGroup -Identity $Group -ErrorAction SilentlyContinue
        if (-not $GroupExists) {
            New-ADGroup -Name $Group -GroupScope Global -ErrorAction SilentlyContinue
            Write-Host "Created group: $Group" -ForegroundColor Green
        }
    } catch {
        Write-Host "Group $Group may already exist or error: $_" -ForegroundColor Yellow
    }
}

# Add users to group
try {
    Add-ADGroupMember -Identity "AppLocker-Users" -Members testuser1,testuser2 -ErrorAction SilentlyContinue
    Write-Host "Added users to AppLocker-Users group" -ForegroundColor Green
} catch {
    Write-Host "Could not add users to group: $_" -ForegroundColor Yellow
}

Write-Host "=== Domain Controller setup complete ===" -ForegroundColor Green
Write-Host "Domain: $DomainName" -ForegroundColor Cyan
Write-Host "NetBIOS: $DomainNetBIOS" -ForegroundColor Cyan
Write-Host "Admin Password: $DomainAdminPassword" -ForegroundColor Cyan

# Create AppLocker security groups
Write-Host "Creating AppLocker security groups..." -ForegroundColor Yellow
$AppLockerGroups = @(
    "GA-ASI\AppLocker-Exe-Allow",
    "GA-ASI\AppLocker-Exe-Deny",
    "GA-ASI\AppLocker-Script-Allow",
    "GA-ASI\AppLocker-Script-Deny"
)

foreach ($GroupName in $AppLockerGroups) {
    try {
        $GroupExists = Get-ADGroup -Filter "Name -eq '$($GroupName.Split('\')[-1])'" -ErrorAction SilentlyContinue
        if (-not $GroupExists) {
            New-ADGroup -Name ($GroupName.Split('\')[-1]) -GroupScope Global -GroupCategory Security -ErrorAction SilentlyContinue
            Write-Host "Created group: $GroupName" -ForegroundColor Green
        }
    } catch {
        Write-Host "Group $GroupName may already exist or error: $_" -ForegroundColor Yellow
    }
}

# Create users and groups if script exists
if (Test-Path "C:\scripts\create-users-and-groups.ps1") {
    Write-Host "`nCreating users and groups..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    & "C:\scripts\create-users-and-groups.ps1"
}

# Run tests if test script exists
if (Test-Path "C:\scripts\run-functionality-tests.ps1") {
    Write-Host "`nRunning functionality tests..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    & "C:\scripts\run-functionality-tests.ps1"
}

# Keep container running
Write-Host "`nDomain Controller is running. Press Ctrl+C to stop." -ForegroundColor Yellow
while ($true) {
    Start-Sleep -Seconds 60
}
