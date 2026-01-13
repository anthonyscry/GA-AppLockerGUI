# Docker Installation Script for Windows
# This script helps install Docker Desktop on Windows

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Docker Desktop Installation Helper                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
$dockerPath = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerPath = "docker"
} elseif (Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe") {
    $dockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
} elseif (Test-Path "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe") {
    $dockerPath = "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"
}

if ($dockerPath) {
    Write-Host "✅ Docker is already installed!" -ForegroundColor Green
    Write-Host "   Location: $dockerPath" -ForegroundColor Gray
    & $dockerPath --version
    Write-Host ""
    Write-Host "Checking if Docker Desktop is running..." -ForegroundColor Yellow
    $dockerInfo = & $dockerPath info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker Desktop is running!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now run: .\run-tests-enhanced.ps1" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Docker Desktop is installed but not running" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please:" -ForegroundColor Yellow
        Write-Host "  1. Start Docker Desktop from Start Menu" -ForegroundColor White
        Write-Host "  2. Wait for it to fully start (check system tray)" -ForegroundColor White
        Write-Host "  3. Run: .\run-tests-enhanced.ps1" -ForegroundColor White
    }
    exit 0
}

Write-Host "Docker Desktop is not installed." -ForegroundColor Yellow
Write-Host ""

# Check for Chocolatey
Write-Host "[OPTION 1] Installing via Chocolatey (Recommended)" -ForegroundColor Cyan
$chocoAvailable = Get-Command choco -ErrorAction SilentlyContinue
if ($chocoAvailable) {
    Write-Host "✅ Chocolatey is available" -ForegroundColor Green
    Write-Host ""
    $install = Read-Host "Install Docker Desktop via Chocolatey? (Y/N)"
    if ($install -eq "Y" -or $install -eq "y") {
        Write-Host "Installing Docker Desktop..." -ForegroundColor Yellow
        Write-Host "This may take several minutes..." -ForegroundColor Gray
        choco install docker-desktop -y
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Docker Desktop installed successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "  1. Start Docker Desktop from Start Menu" -ForegroundColor White
            Write-Host "  2. Wait for it to fully initialize" -ForegroundColor White
            Write-Host "  3. Run: .\run-tests-enhanced.ps1" -ForegroundColor White
            exit 0
        } else {
            Write-Host "❌ Installation failed. Try manual installation." -ForegroundColor Red
        }
    }
} else {
    Write-Host "⚠️  Chocolatey not found" -ForegroundColor Yellow
    Write-Host "   Install Chocolatey first: https://chocolatey.org/install" -ForegroundColor Gray
    Write-Host "   Or use manual installation (Option 2)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[OPTION 2] Manual Installation" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Download Docker Desktop:" -ForegroundColor Yellow
Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor White
Write-Host ""
Write-Host "2. Run the installer (Docker Desktop Installer.exe)" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Follow the installation wizard:" -ForegroundColor Yellow
Write-Host "   - Accept the license" -ForegroundColor White
Write-Host "   - Choose installation location" -ForegroundColor White
Write-Host "   - Complete the installation" -ForegroundColor White
Write-Host ""
Write-Host "4. Start Docker Desktop:" -ForegroundColor Yellow
Write-Host "   - Find 'Docker Desktop' in Start Menu" -ForegroundColor White
Write-Host "   - Launch it and wait for it to start" -ForegroundColor White
Write-Host "   - Check system tray for Docker icon" -ForegroundColor White
Write-Host ""
Write-Host "5. Verify installation:" -ForegroundColor Yellow
Write-Host "   - Run: .\validate-setup.ps1" -ForegroundColor White
Write-Host "   - Or run: .\run-tests-enhanced.ps1" -ForegroundColor White
Write-Host ""

# Offer to open download page
$openBrowser = Read-Host "Open Docker Desktop download page in browser? (Y/N)"
if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
    Start-Process "https://www.docker.com/products/docker-desktop"
    Write-Host "✅ Browser opened to Docker Desktop download page" -ForegroundColor Green
}

Write-Host ""
Write-Host "After installation, run: .\validate-setup.ps1" -ForegroundColor Cyan
Write-Host ""
