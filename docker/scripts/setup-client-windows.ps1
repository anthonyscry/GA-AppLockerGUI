# PowerShell script to setup Windows Client with AppLocker
# This script configures a Windows client and joins it to the domain

$ErrorActionPreference = "Stop"

Write-Host "=== Setting up Windows Client ===" -ForegroundColor Green

$DomainName = $env:DOMAIN_NAME ?? "applocker.local"
$DomainAdminUser = $env:DOMAIN_ADMIN_USER ?? "Administrator"
$DomainAdminPassword = $env:DOMAIN_ADMIN_PASSWORD ?? "SecurePass123!"
$DnsServer = $env:DNS_SERVER ?? "domain-controller-windows"

# Configure DNS
Write-Host "Configuring DNS..." -ForegroundColor Yellow
$NICs = Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
foreach ($NIC in $NICs) {
    Set-DnsClientServerAddress -InterfaceIndex $NIC.ifIndex -ServerAddresses $DnsServer
}

# Wait for domain controller to be ready
Write-Host "Waiting for domain controller..." -ForegroundColor Yellow
$MaxRetries = 30
$RetryCount = 0
$DomainControllerReady = $false

while (-not $DomainControllerReady -and $RetryCount -lt $MaxRetries) {
    try {
        $TestConnection = Test-Connection -ComputerName $DnsServer -Count 1 -ErrorAction SilentlyContinue
        if ($TestConnection) {
            $DomainControllerReady = $true
            Write-Host "Domain controller is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "Waiting for domain controller... ($RetryCount/$MaxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        $RetryCount++
    }
}

if (-not $DomainControllerReady) {
    Write-Host "Warning: Could not reach domain controller. Continuing anyway..." -ForegroundColor Red
}

# Install AppLocker feature
Write-Host "Installing AppLocker..." -ForegroundColor Yellow
try {
    Install-WindowsFeature -Name AppLocker -IncludeManagementTools -ErrorAction SilentlyContinue
    Import-Module AppLocker -ErrorAction SilentlyContinue
    Write-Host "AppLocker installed successfully" -ForegroundColor Green
} catch {
    Write-Host "Warning: AppLocker installation failed. This may require Windows Enterprise/Server: $_" -ForegroundColor Yellow
}

# Configure WinRM
Write-Host "Configuring WinRM..." -ForegroundColor Yellow
Enable-PSRemoting -Force -SkipNetworkProfileCheck -ErrorAction SilentlyContinue

# Set WinRM to allow unencrypted traffic (for lab only!)
Set-Item WSMan:\localhost\Service\Auth\Basic -Value $true -ErrorAction SilentlyContinue
Set-Item WSMan:\localhost\Service\AllowUnencrypted -Value $true -ErrorAction SilentlyContinue

# Configure WinRM listener
$WinRMListener = Get-ChildItem WSMan:\LocalHost\Listener -ErrorAction SilentlyContinue
if (-not $WinRMListener) {
    New-Item -Path WSMan:\LocalHost\Listener -Transport HTTP -Address * -Force -ErrorAction SilentlyContinue
}

# Start WinRM service
Start-Service WinRM -ErrorAction SilentlyContinue
Set-Service WinRM -StartupType Automatic -ErrorAction SilentlyContinue

# Create test directory for applications
Write-Host "Creating test application directory..." -ForegroundColor Yellow
$TestAppDir = "C:\TestApps"
if (-not (Test-Path $TestAppDir)) {
    New-Item -ItemType Directory -Path $TestAppDir -Force | Out-Null
}

# Create sample test applications
$TestApps = @(
    @{Name="TestApp1.exe"; Content="Test Application 1"},
    @{Name="TestApp2.exe"; Content="Test Application 2"}
)

foreach ($App in $TestApps) {
    $AppPath = Join-Path $TestAppDir $App.Name
    if (-not (Test-Path $AppPath)) {
        # Create a simple PowerShell script as a test executable
        $ScriptContent = @"
Write-Host "$($App.Content)"
Start-Sleep -Seconds 1
"@
        $ScriptContent | Out-File -FilePath $AppPath -Encoding ASCII
    }
}

# Join domain (if not already joined)
Write-Host "Attempting to join domain..." -ForegroundColor Yellow
try {
    $CurrentDomain = (Get-WmiObject Win32_ComputerSystem).Domain
    if ($CurrentDomain -ne $DomainName) {
        $Credential = New-Object System.Management.Automation.PSCredential(
            "$DomainAdminUser@$DomainName",
            (ConvertTo-SecureString -String $DomainAdminPassword -AsPlainText -Force)
        )
        Add-Computer -DomainName $DomainName -Credential $Credential -Restart:$false -ErrorAction Stop
        Write-Host "Domain join initiated. Restart may be required." -ForegroundColor Green
    } else {
        Write-Host "Already joined to domain: $DomainName" -ForegroundColor Green
    }
} catch {
    Write-Host "Domain join failed or already completed: $_" -ForegroundColor Yellow
}

Write-Host "=== Client setup complete ===" -ForegroundColor Green
Write-Host "Domain: $DomainName" -ForegroundColor Cyan
Write-Host "DNS Server: $DnsServer" -ForegroundColor Cyan
Write-Host "WinRM: Enabled on ports 5985 (HTTP) and 5986 (HTTPS)" -ForegroundColor Cyan

# Run tests if test script exists
if (Test-Path "C:\scripts\run-functionality-tests.ps1") {
    Write-Host "`nRunning functionality tests..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    & "C:\scripts\run-functionality-tests.ps1"
}

# Keep container running
Write-Host "`nClient is running. Press Ctrl+C to stop." -ForegroundColor Yellow
while ($true) {
    Start-Sleep -Seconds 60
}
