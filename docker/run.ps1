# Run script for GA-AppLocker Lab Environment
# This script starts the Docker lab environment

param(
    [string]$ComposeFile = "docker-compose.yml",
    [switch]$Build,
    [switch]$Detached = $true
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "GA-AppLocker Lab Environment - Run" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is available
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "✅ Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not available. Please:" -ForegroundColor Red
    Write-Host "   1. Install Docker Desktop" -ForegroundColor Yellow
    Write-Host "   2. Start Docker Desktop" -ForegroundColor Yellow
    Write-Host "   3. Ensure Docker is in your PATH" -ForegroundColor Yellow
    exit 1
}

# Check if Docker daemon is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker daemon is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is available
try {
    $composeVersion = docker compose version 2>&1
    Write-Host "✅ Docker Compose found: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not available. Please install Docker Compose v2.0+" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Navigate to docker directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Build if requested
if ($Build) {
    Write-Host "Building containers..." -ForegroundColor Yellow
    docker compose -f $ComposeFile build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
}

# Start containers
Write-Host "Starting containers..." -ForegroundColor Yellow
if ($Detached) {
    docker compose -f $ComposeFile up -d
} else {
    docker compose -f $ComposeFile up
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start containers" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Containers started successfully!" -ForegroundColor Green
Write-Host ""

# Show container status
Write-Host "Container Status:" -ForegroundColor Cyan
docker compose -f $ComposeFile ps

Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs:     docker compose -f $ComposeFile logs -f" -ForegroundColor Gray
Write-Host "  Stop:          docker compose -f $ComposeFile down" -ForegroundColor Gray
Write-Host "  Shell (app):   docker exec -it ga-applocker-app bash" -ForegroundColor Gray
Write-Host "  Shell (dc):    docker exec -it ga-applocker-dc bash" -ForegroundColor Gray
Write-Host "  Shell (client): docker exec -it ga-applocker-client bash" -ForegroundColor Gray
Write-Host ""
