# PowerShell quick start script for GA-AppLocker Lab Environment

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "GA-AppLocker Lab Environment - Quick Start" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is available
try {
    docker compose version | Out-Null
} catch {
    Write-Host "❌ Docker Compose is not available. Please install Docker Compose v2.0+" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Ask user which setup to use
Write-Host "Select setup type:" -ForegroundColor Yellow
Write-Host "1) Linux containers (AD simulation, faster startup)" -ForegroundColor White
Write-Host "2) Windows containers (full AppLocker support, requires Windows)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Enter choice [1 or 2]"

$ComposeFile = "docker-compose.yml"
if ($choice -eq "2") {
    $ComposeFile = "docker-compose.windows.yml"
    Write-Host "Using Windows containers..." -ForegroundColor Yellow
    Write-Host "⚠️  Make sure Windows containers are enabled in Docker Desktop!" -ForegroundColor Yellow
} else {
    Write-Host "Using Linux containers..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting lab environment..." -ForegroundColor Yellow
Write-Host ""

# Build and start containers
docker compose -f $ComposeFile up -d --build

Write-Host ""
Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Show container status
Write-Host ""
Write-Host "Container Status:" -ForegroundColor Cyan
docker compose -f $ComposeFile ps

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Lab environment is starting!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view logs:" -ForegroundColor White
Write-Host "  docker compose -f $ComposeFile logs -f" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop:" -ForegroundColor White
Write-Host "  docker compose -f $ComposeFile down" -ForegroundColor Gray
Write-Host ""
Write-Host "To access app container:" -ForegroundColor White
Write-Host "  docker exec -it ga-applocker-app powershell" -ForegroundColor Gray
Write-Host ""
Write-Host "Default credentials:" -ForegroundColor White
Write-Host "  Domain: applocker.local" -ForegroundColor Gray
Write-Host "  Admin: Administrator / SecurePass123!" -ForegroundColor Gray
Write-Host ""
