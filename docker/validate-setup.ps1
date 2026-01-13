# Validation Script - Checks if Docker environment is ready
# Run this before running the test suite

Write-Host "=== Docker Environment Validation ===" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: Docker Installation
Write-Host "[CHECK 1] Docker Installation" -ForegroundColor Yellow
$dockerPath = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerPath = "docker"
    Write-Host "   ✅ Docker found in PATH" -ForegroundColor Green
} elseif (Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe") {
    $dockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    Write-Host "   ✅ Docker found in default location" -ForegroundColor Green
} else {
    Write-Host "   ❌ Docker not found" -ForegroundColor Red
    Write-Host "      Install from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    $allGood = $false
}

# Check 2: Docker Running
if ($dockerPath) {
    Write-Host "[CHECK 2] Docker Daemon Status" -ForegroundColor Yellow
    $dockerInfo = & $dockerPath info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker daemon is running" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Docker daemon is not running" -ForegroundColor Red
        Write-Host "      Start Docker Desktop and wait for it to initialize" -ForegroundColor Yellow
        $allGood = $false
    }
}

# Check 3: Docker Compose
if ($dockerPath -and $allGood) {
    Write-Host "[CHECK 3] Docker Compose" -ForegroundColor Yellow
    $composeCheck = & $dockerPath compose version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker Compose available" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Docker Compose not available" -ForegroundColor Red
        $allGood = $false
    }
}

# Check 4: Required Files
Write-Host "[CHECK 4] Required Files" -ForegroundColor Yellow
$requiredFiles = @(
    "docker-compose.yml",
    "Dockerfile.app.linux",
    "test-app.ps1",
    "run-tests-enhanced.ps1"
)
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file missing" -ForegroundColor Red
        $allGood = $false
    }
}

# Summary
Write-Host ""
if ($allGood) {
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
    Write-Host "✅ All checks passed! Ready to run tests." -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Run: .\run-tests-enhanced.ps1" -ForegroundColor Cyan
} else {
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Red
    Write-Host "❌ Some checks failed. Please fix issues above." -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  1. Install Docker Desktop" -ForegroundColor White
    Write-Host "  2. Start Docker Desktop" -ForegroundColor White
    Write-Host "  3. Wait for Docker to fully start" -ForegroundColor White
    Write-Host "  4. Ensure all files are in docker/ directory" -ForegroundColor White
}
Write-Host ""
