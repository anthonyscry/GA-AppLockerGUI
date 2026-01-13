# Run Expanded Windows Server 2019 Docker Tests
# Orchestrates the expanded test suite with multiple servers and users

param(
    [switch]$Build,
    [switch]$Up,
    [switch]$Test,
    [switch]$Down,
    [switch]$All,
    [switch]$Logs,
    [switch]$UsersOnly
)

$ErrorActionPreference = "Stop"

$ComposeFile = "docker-compose.windows2019-expanded.yml"
$ProjectName = "ga-applocker-expanded-2019"

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

if ($All -or $Build) {
    Write-Step "Building Expanded Windows Server 2019 containers..."
    docker-compose -f $ComposeFile -p $ProjectName build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
}

if ($All -or $Up) {
    Write-Step "Starting Expanded Windows Server 2019 containers..."
    docker-compose -f $ComposeFile -p $ProjectName up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Start failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Waiting for containers to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 120
    
    Write-Host "Waiting for Primary DC to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 120
    
    Write-Host "Waiting for Backup DC to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 120
    
    Write-Host "Waiting for Member Servers to join domain..." -ForegroundColor Yellow
    Start-Sleep -Seconds 120
    
    Write-Host "All containers started. Environment should be ready." -ForegroundColor Green
}

if ($All -or $Test) {
    Write-Step "Running expanded environment tests..."
    
    if ($UsersOnly) {
        Write-Host "Running user creation script only..." -ForegroundColor Yellow
        docker exec ga-applocker-dc-2019 powershell -File C:\scripts\create-users-and-groups.ps1
    } else {
        # Run comprehensive tests on primary DC
        Write-Host "Running comprehensive tests on primary DC..." -ForegroundColor Yellow
        docker exec ga-applocker-dc-2019 powershell -File C:\scripts\test-expanded-environment.ps1
        
        # Run tests on client
        Write-Host "Running tests on client container..." -ForegroundColor Yellow
        docker exec ga-applocker-client-2019 powershell -File C:\scripts\run-functionality-tests.ps1
        
        # Run tests on member servers
        $MemberServers = @(
            "ga-applocker-member-01-2019",
            "ga-applocker-member-02-2019",
            "ga-applocker-member-03-2019",
            "ga-applocker-member-04-2019"
        )
        
        foreach ($Server in $MemberServers) {
            Write-Host "Running tests on $Server..." -ForegroundColor Yellow
            docker exec $Server powershell -File C:\scripts\run-functionality-tests.ps1 -ErrorAction SilentlyContinue
        }
    }
    
    # Copy test results
    Write-Host "Copying test results..." -ForegroundColor Yellow
    $ResultsDir = ".\test-results-expanded"
    if (-not (Test-Path $ResultsDir)) {
        New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
    }
    
    # Copy from all containers
    $Containers = @(
        "ga-applocker-dc-2019",
        "ga-applocker-backup-dc-2019",
        "ga-applocker-client-2019",
        "ga-applocker-member-01-2019",
        "ga-applocker-member-02-2019",
        "ga-applocker-member-03-2019",
        "ga-applocker-member-04-2019"
    )
    
    foreach ($Container in $Containers) {
        $ContainerName = $Container.Split('-')[-1]
        try {
            docker cp "$Container`:C:\test-results" "$ResultsDir\$ContainerName-results" -ErrorAction SilentlyContinue
            docker cp "$Container`:C:\logs" "$ResultsDir\$ContainerName-logs" -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Could not copy results from $Container" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nTest results saved to:" -ForegroundColor Green
    Write-Host "  - $ResultsDir" -ForegroundColor White
}

if ($Logs) {
    Write-Step "Showing container logs..."
    docker-compose -f $ComposeFile -p $ProjectName logs --tail=100
}

if ($All -or $Down) {
    Write-Host "`nStopping containers..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile -p $ProjectName down
}

if (-not ($Build -or $Up -or $Test -or $Down -or $Logs -or $All -or $UsersOnly)) {
    Write-Host "Usage: .\run-expanded-tests.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Build      Build containers" -ForegroundColor White
    Write-Host "  -Up         Start containers" -ForegroundColor White
    Write-Host "  -Test       Run tests" -ForegroundColor White
    Write-Host "  -Down       Stop containers" -ForegroundColor White
    Write-Host "  -Logs       Show logs" -ForegroundColor White
    Write-Host "  -All        Build, start, test, and show results" -ForegroundColor White
    Write-Host "  -UsersOnly  Only create users and groups (no tests)" -ForegroundColor White
    Write-Host ""
    Write-Host "Example: .\run-expanded-tests.ps1 -All" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Environment includes:" -ForegroundColor Cyan
    Write-Host "  - Primary DC (DC01)" -ForegroundColor White
    Write-Host "  - Backup DC (DC02)" -ForegroundColor White
    Write-Host "  - Client (CLIENT01)" -ForegroundColor White
    Write-Host "  - 4 Member Servers (FILESERVER01, APPSERVER01, WEBSERVER01, DBSERVER01)" -ForegroundColor White
    Write-Host "  - 40+ Users across 8 departments" -ForegroundColor White
    Write-Host "  - 20+ Security Groups" -ForegroundColor White
}
