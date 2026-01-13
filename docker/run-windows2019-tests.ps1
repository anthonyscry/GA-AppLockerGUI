# Run Windows Server 2019 Docker Tests
# Orchestrates the entire test suite

param(
    [switch]$Build,
    [switch]$Up,
    [switch]$Test,
    [switch]$Down,
    [switch]$All,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"

$ComposeFile = "docker-compose.windows2019.yml"
$ProjectName = "ga-applocker-windows2019"

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

if ($All -or $Build) {
    Write-Step "Building Windows Server 2019 containers..."
    docker-compose -f $ComposeFile -p $ProjectName build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
}

if ($All -or $Up) {
    Write-Step "Starting Windows Server 2019 containers..."
    docker-compose -f $ComposeFile -p $ProjectName up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Start failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Waiting for containers to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 120
    
    Write-Host "Containers started. Waiting for AD DS to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 60
}

if ($All -or $Test) {
    Write-Step "Running functionality tests..."
    
    # Run tests on client container
    Write-Host "Running tests on client container..." -ForegroundColor Yellow
    docker exec ga-applocker-client-2019 powershell -File C:\scripts\run-functionality-tests.ps1
    
    # Copy test results
    Write-Host "Copying test results..." -ForegroundColor Yellow
    $ResultsDir = ".\test-results"
    if (-not (Test-Path $ResultsDir)) {
        New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
    }
    
    docker cp ga-applocker-client-2019:C:\test-results $ResultsDir\client-results
    docker cp ga-applocker-dc-2019:C:\test-results $ResultsDir\dc-results -ErrorAction SilentlyContinue
    
    Write-Host "`nTest results saved to:" -ForegroundColor Green
    Write-Host "  - $ResultsDir\client-results" -ForegroundColor White
    Write-Host "  - $ResultsDir\dc-results" -ForegroundColor White
}

if ($Logs) {
    Write-Step "Showing container logs..."
    docker-compose -f $ComposeFile -p $ProjectName logs --tail=100
}

if ($All -or $Down) {
    Write-Host "`nStopping containers..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile -p $ProjectName down
}

if (-not ($Build -or $Up -or $Test -or $Down -or $Logs -or $All)) {
    Write-Host "Usage: .\run-windows2019-tests.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Build    Build containers" -ForegroundColor White
    Write-Host "  -Up       Start containers" -ForegroundColor White
    Write-Host "  -Test     Run tests" -ForegroundColor White
    Write-Host "  -Down     Stop containers" -ForegroundColor White
    Write-Host "  -Logs     Show logs" -ForegroundColor White
    Write-Host "  -All      Build, start, test, and show results" -ForegroundColor White
    Write-Host ""
    Write-Host "Example: .\run-windows2019-tests.ps1 -All" -ForegroundColor Cyan
}
