# Automated Docker Installation Script
# Attempts to install Docker Desktop automatically

param(
    [switch]$Force
)

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Automated Docker Desktop Installation                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
function Test-DockerInstalled {
    if (Get-Command docker -ErrorAction SilentlyContinue) { return $true }
    if (Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe") { return $true }
    if (Test-Path "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe") { return $true }
    return $false
}

if (Test-DockerInstalled) {
    Write-Host "✅ Docker is already installed!" -ForegroundColor Green
    Write-Host "Run: .\run-tests-enhanced.ps1" -ForegroundColor Cyan
    exit 0
}

Write-Host "Docker Desktop not found. Attempting installation..." -ForegroundColor Yellow
Write-Host ""

# Method 1: Try Chocolatey
Write-Host "[METHOD 1] Trying Chocolatey installation..." -ForegroundColor Cyan
$choco = Get-Command choco -ErrorAction SilentlyContinue
if ($choco) {
    Write-Host "✅ Chocolatey found - installing Docker Desktop..." -ForegroundColor Green
    Write-Host "   This will download and install Docker Desktop (may take 10-15 minutes)" -ForegroundColor Gray
    Write-Host ""
    
    # Check if running as admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "⚠️  Administrator privileges required for installation" -ForegroundColor Yellow
        Write-Host "   Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
        Write-Host "   Or use: install-docker.ps1 for manual installation guide" -ForegroundColor Yellow
        exit 1
    }
    
    try {
        choco install docker-desktop -y
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Docker Desktop installed successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "  1. Start Docker Desktop from Start Menu" -ForegroundColor White
            Write-Host "  2. Wait for it to fully initialize (check system tray)" -ForegroundColor White
            Write-Host "  3. Run: .\run-tests-enhanced.ps1" -ForegroundColor White
            exit 0
        }
    } catch {
        Write-Host "❌ Chocolatey installation failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Chocolatey not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[METHOD 2] Manual Installation Required" -ForegroundColor Cyan
Write-Host ""
Write-Host "Chocolatey installation not available. Please install manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Download Docker Desktop:" -ForegroundColor White
Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Run the installer" -ForegroundColor White
Write-Host ""
Write-Host "3. Start Docker Desktop and wait for it to initialize" -ForegroundColor White
Write-Host ""
Write-Host "4. Run: .\validate-setup.ps1" -ForegroundColor White
Write-Host ""

# Offer to install Chocolatey first
$installChoco = Read-Host "Would you like to install Chocolatey first? (Y/N)"
if ($installChoco -eq "Y" -or $installChoco -eq "y") {
    Write-Host "Installing Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Chocolatey installed! Now installing Docker Desktop..." -ForegroundColor Green
        choco install docker-desktop -y
    }
}

Write-Host ""
Write-Host "For manual installation guide, run: .\install-docker.ps1" -ForegroundColor Cyan
Write-Host ""
