# Quick Docker Test - Simplified Version
# Use this for faster testing when Docker is already set up

Write-Host "Quick Docker Test" -ForegroundColor Cyan
Write-Host ""

# Find Docker
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    $docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    if (-not (Test-Path $docker)) {
        Write-Host "❌ Docker not found. Please install Docker Desktop." -ForegroundColor Red
        exit 1
    }
} else {
    $docker = $docker.Source
}

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
& $docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green

# Navigate to docker directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Start containers
Write-Host "Starting containers..." -ForegroundColor Yellow
& $docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start containers" -ForegroundColor Red
    exit 1
}

# Wait a bit
Write-Host "Waiting 20 seconds for services..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Check status
Write-Host "Container status:" -ForegroundColor Yellow
& $docker compose ps

Write-Host ""
Write-Host "✅ Quick test complete!" -ForegroundColor Green
Write-Host "Run full tests: .\run-tests-enhanced.ps1" -ForegroundColor Cyan
