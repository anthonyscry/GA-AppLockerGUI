# Download and Install Docker Desktop
# This script downloads Docker Desktop installer and guides you through installation

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Docker Desktop Download & Install Helper               ║" -ForegroundColor Cyan
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

Write-Host "Docker Desktop not found. Downloading installer..." -ForegroundColor Yellow
Write-Host ""

# Create temp directory
$tempDir = "$env:TEMP\docker-install"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

$installerPath = Join-Path $tempDir "DockerDesktopInstaller.exe"
$downloadUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

Write-Host "Downloading Docker Desktop installer..." -ForegroundColor Cyan
Write-Host "   URL: $downloadUrl" -ForegroundColor Gray
Write-Host "   Save to: $installerPath" -ForegroundColor Gray
Write-Host "   This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

try {
    # Download with progress
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    
    if (Test-Path $installerPath) {
        $fileSize = (Get-Item $installerPath).Length / 1MB
        $fileSizeRounded = [math]::Round($fileSize, 2)
        Write-Host "✅ Download complete! ($fileSizeRounded MB)" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Installer ready at: $installerPath" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Run the installer (requires Administrator privileges)" -ForegroundColor White
        Write-Host "  2. Follow the installation wizard" -ForegroundColor White
        Write-Host "  3. Start Docker Desktop after installation" -ForegroundColor White
        Write-Host "  4. Wait for Docker to fully start" -ForegroundColor White
        Write-Host "  5. Run: .\run-tests-enhanced.ps1" -ForegroundColor White
        Write-Host ""
        
        $runNow = Read-Host "Open installer now? (Y/N)"
        if ($runNow -eq "Y" -or $runNow -eq "y") {
            Write-Host "Launching installer..." -ForegroundColor Cyan
            Write-Host "   Note: You may be prompted for Administrator privileges" -ForegroundColor Yellow
            Start-Process -FilePath $installerPath -Wait
            Write-Host ""
            Write-Host "After installation completes:" -ForegroundColor Cyan
            Write-Host "  1. Start Docker Desktop from Start Menu" -ForegroundColor White
            Write-Host "  2. Wait for it to initialize" -ForegroundColor White
            Write-Host "  3. Run: .\run-tests-enhanced.ps1" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "To install later, run:" -ForegroundColor Cyan
            Write-Host "  Start-Process '$installerPath'" -ForegroundColor White
        }
    } else {
        Write-Host "❌ Download failed" -ForegroundColor Red
        Write-Host "   Please download manually from:" -ForegroundColor Yellow
        Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Download error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download manually:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "  2. Download Docker Desktop Installer" -ForegroundColor White
    Write-Host "  3. Run the installer" -ForegroundColor White
    Write-Host "  4. Start Docker Desktop" -ForegroundColor White
    Write-Host "  5. Run: .\run-tests-enhanced.ps1" -ForegroundColor White
}

Write-Host ""
