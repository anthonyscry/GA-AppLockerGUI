# Comprehensive Docker Environment Test Script
# Run this script to test the application in Docker

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GA-AppLocker Docker Environment Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to find Docker executable
function Find-Docker {
    # Try PATH first
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        return $dockerCmd.Source
    }
    
    # Check common Windows installation paths
    $commonPaths = @(
        "C:\Program Files\Docker\Docker\resources\bin\docker.exe",
        "C:\Program Files\Docker\Docker\resources\docker.exe",
        "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
        "$env:LOCALAPPDATA\Docker\resources\bin\docker.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    return $null
}

# Check Docker availability
Write-Host "[1/8] Checking Docker..." -ForegroundColor Yellow
$dockerPath = Find-Docker
if (-not $dockerPath) {
    Write-Host "❌ Docker not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Docker Desktop:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "  2. Install and start Docker Desktop" -ForegroundColor White
    Write-Host "  3. Ensure Docker Desktop is running (check system tray)" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    exit 1
}

Write-Host "✅ Docker found: $dockerPath" -ForegroundColor Green

# Test Docker is actually working
$dockerVersion = & $dockerPath --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is installed but not responding" -ForegroundColor Red
    Write-Host "   Make sure Docker Desktop is running" -ForegroundColor Yellow
    Write-Host "   Error: $dockerVersion" -ForegroundColor Red
    exit 1
}
Write-Host "   $dockerVersion" -ForegroundColor Gray
Write-Host ""

# Check if Docker daemon is running
Write-Host "   Checking Docker daemon..." -ForegroundColor Gray
$dockerInfo = & $dockerPath info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker daemon is not running" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop" -ForegroundColor Yellow
    Write-Host "   Error: $($dockerInfo -join '`n')" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Docker daemon is running" -ForegroundColor Green
Write-Host ""

# Check Docker Compose
Write-Host "[2/8] Checking Docker Compose..." -ForegroundColor Yellow
$composeVersion = & $dockerPath compose version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker Compose not available" -ForegroundColor Red
    Write-Host "   Docker Compose should be included with Docker Desktop" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Docker Compose available" -ForegroundColor Green
Write-Host "   $composeVersion" -ForegroundColor Gray
Write-Host ""

# Start environment
Write-Host "[3/8] Starting Docker environment..." -ForegroundColor Yellow
Write-Host "   This may take several minutes on first run..." -ForegroundColor Gray

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

& $dockerPath compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start containers" -ForegroundColor Red
    Write-Host "   Check Docker Desktop is running and has enough resources" -ForegroundColor Yellow
    Write-Host "   Try: docker compose logs" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Containers starting..." -ForegroundColor Green
Write-Host ""

# Wait for initialization
Write-Host "[4/8] Waiting for services to initialize (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30
Write-Host "✅ Wait complete" -ForegroundColor Green
Write-Host ""

# Check container status
Write-Host "[5/8] Checking container status..." -ForegroundColor Yellow
& $dockerPath compose ps
$containerStatus = & $dockerPath compose ps --format json | ConvertFrom-Json
$allRunning = $true
foreach ($container in $containerStatus) {
    if ($container.State -ne "running") {
        Write-Host "   ⚠️  $($container.Name) is $($container.State)" -ForegroundColor Yellow
        $allRunning = $false
    } else {
        Write-Host "   ✅ $($container.Name) is running" -ForegroundColor Green
    }
}
if (-not $allRunning) {
    Write-Host "   Waiting additional 30 seconds for containers to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    & $dockerPath compose ps
}
Write-Host ""

# Run application test suite
Write-Host "[6/8] Running application test suite..." -ForegroundColor Yellow
# Check if container is ready
$containerReady = & $dockerPath exec ga-applocker-app echo "ready" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Container not ready yet, waiting..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Copy test script into container if needed, or run directly
& $dockerPath exec ga-applocker-app powershell -Command "if (Test-Path 'C:\app\docker\test-app.ps1') { C:\app\docker\test-app.ps1 } else { Write-Host 'Test script not found in container' }"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Some tests may have failed" -ForegroundColor Yellow
    Write-Host "   You can run tests manually:" -ForegroundColor Gray
    Write-Host "   docker exec -it ga-applocker-app powershell" -ForegroundColor White
    Write-Host "   cd C:\app; .\docker\test-app.ps1" -ForegroundColor White
} else {
    Write-Host "✅ Application tests passed" -ForegroundColor Green
}
Write-Host ""

# Test React app build
Write-Host "[7/8] Testing React app build..." -ForegroundColor Yellow
& $dockerPath exec ga-applocker-app powershell -Command "cd C:\app; if (-not (Test-Path node_modules)) { npm install }; npm run build"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    Write-Host "   Check logs: docker exec ga-applocker-app powershell -Command 'cd C:\app; npm run build'" -ForegroundColor Yellow
}
Write-Host ""

# Verify PowerShell scripts
Write-Host "[8/8] Verifying PowerShell scripts..." -ForegroundColor Yellow
$scripts = & $dockerPath exec ga-applocker-app powershell -Command "cd C:\app\scripts; if (Test-Path C:\app\scripts) { Get-ChildItem *.ps1 | Select-Object -ExpandProperty Name } else { Write-Host 'Scripts directory not found' }"
if ($scripts) {
    Write-Host "Found scripts:" -ForegroundColor Cyan
    $scripts | ForEach-Object { Write-Host "  ✅ $_" -ForegroundColor Green }
} else {
    Write-Host "  ⚠️  No scripts found or scripts directory missing" -ForegroundColor Yellow
}
Write-Host ""

# Final summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Container Status:" -ForegroundColor Yellow
& $dockerPath compose ps
Write-Host ""
Write-Host "To access the application:" -ForegroundColor Cyan
Write-Host "  docker exec -it ga-applocker-app powershell" -ForegroundColor White
Write-Host "  cd C:\app" -ForegroundColor White
Write-Host "  npm install  # if not already done" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "  # Then open http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Cyan
Write-Host "  docker compose logs -f" -ForegroundColor White
Write-Host "  docker compose logs app-dev" -ForegroundColor White
Write-Host ""
Write-Host "To stop containers:" -ForegroundColor Cyan
Write-Host "  docker compose down" -ForegroundColor White
Write-Host ""
Write-Host "✅ Testing complete!" -ForegroundColor Green
