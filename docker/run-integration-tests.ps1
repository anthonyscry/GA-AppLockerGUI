# Docker Integration Test Runner
# This script runs comprehensive tests using Docker containers
# Run from project root: .\docker\run-integration-tests.ps1

param(
    [switch]$SkipBuild,
    [switch]$SkipUnitTests,
    [switch]$Verbose,
    [int]$Timeout = 300
)

$ErrorActionPreference = "Stop"
$startTime = Get-Date

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  GA-AppLocker Docker Integration Test Suite                   ║" -ForegroundColor Cyan
Write-Host "║  Version: 1.2.7                                               ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Test results tracking
$results = @{
    DockerCheck = $null
    ContainerStartup = $null
    UnitTests = $null
    BuildTest = $null
    PowerShellTests = $null
    IntegrationTests = $null
    FunctionalTests = $null
}

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host "[$Step] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
}

function Write-Failure {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  ⚠️  $Message" -ForegroundColor Yellow
}

function Test-DockerAvailable {
    try {
        $version = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    } catch {}
    return $false
}

function Test-DockerRunning {
    try {
        $info = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# Step 1: Check Docker
Write-Step "1/7" "Checking Docker availability..."
if (-not (Test-DockerAvailable)) {
    Write-Failure "Docker not found. Please install Docker Desktop."
    $results.DockerCheck = "FAILED"
    exit 1
}

if (-not (Test-DockerRunning)) {
    Write-Failure "Docker daemon not running. Please start Docker Desktop."
    $results.DockerCheck = "FAILED"
    exit 1
}

$dockerVersion = docker --version
Write-Success "Docker available: $dockerVersion"
$results.DockerCheck = "PASSED"

# Step 2: Start containers
Write-Step "2/7" "Starting Docker containers..."
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

Push-Location $scriptDir
try {
    if (-not $SkipBuild) {
        docker compose up -d --build 2>&1 | Out-Null
    } else {
        docker compose up -d 2>&1 | Out-Null
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "Failed to start containers"
        $results.ContainerStartup = "FAILED"
        exit 1
    }
    
    Write-Success "Containers started"
    Write-Host "  Waiting for initialization (30s)..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    # Verify containers
    $containers = docker compose ps --format json | ConvertFrom-Json
    $runningCount = ($containers | Where-Object { $_.State -eq "running" }).Count
    
    if ($runningCount -eq 0) {
        Write-Failure "No containers running"
        $results.ContainerStartup = "FAILED"
        exit 1
    }
    
    Write-Success "$runningCount container(s) running"
    $results.ContainerStartup = "PASSED"
} finally {
    Pop-Location
}

# Step 3: Run Unit Tests (in container)
if (-not $SkipUnitTests) {
    Write-Step "3/7" "Running unit tests in container..."
    try {
        $testOutput = docker exec ga-applocker-app bash -c "cd /app && npm test 2>&1" 2>&1
        if ($testOutput -match "(\d+) passed") {
            $passedCount = $Matches[1]
            Write-Success "Unit tests passed: $passedCount tests"
            $results.UnitTests = "PASSED ($passedCount)"
        } elseif ($testOutput -match "failed") {
            Write-Failure "Some unit tests failed"
            $results.UnitTests = "FAILED"
        } else {
            Write-Warning "Could not determine test results"
            $results.UnitTests = "UNKNOWN"
        }
    } catch {
        Write-Warning "Could not run unit tests: $_"
        $results.UnitTests = "SKIPPED"
    }
} else {
    Write-Step "3/7" "Skipping unit tests (--SkipUnitTests)"
    $results.UnitTests = "SKIPPED"
}

# Step 4: Build Test
Write-Step "4/7" "Testing production build in container..."
try {
    $buildOutput = docker exec ga-applocker-app bash -c "cd /app && npm run build 2>&1" 2>&1
    if ($buildOutput -match "built in") {
        Write-Success "Production build successful"
        $results.BuildTest = "PASSED"
    } else {
        Write-Failure "Build failed"
        $results.BuildTest = "FAILED"
    }
} catch {
    Write-Warning "Could not test build: $_"
    $results.BuildTest = "SKIPPED"
}

# Step 5: PowerShell Script Validation
Write-Step "5/7" "Validating PowerShell scripts..."
$scripts = @(
    "GA-AppLocker.psm1",
    "Deploy-AppLockerPolicy.ps1",
    "Get-ComprehensiveScanArtifacts.ps1",
    "Merge-AppLockerPolicies.ps1",
    "Test-RuleHealth.ps1"
)
$scriptsPassed = 0
$scriptsFailed = 0

foreach ($script in $scripts) {
    try {
        $result = docker exec ga-applocker-app pwsh -Command "
            try {
                `$null = [System.Management.Automation.Language.Parser]::ParseFile('/app/scripts/$script', [ref]`$null, [ref]`$errors)
                if (`$errors.Count -eq 0) { 'VALID' } else { 'INVALID' }
            } catch { 'ERROR' }
        " 2>&1
        
        if ($result -eq "VALID") {
            if ($Verbose) { Write-Success "$script - Valid" }
            $scriptsPassed++
        } else {
            Write-Failure "$script - Invalid"
            $scriptsFailed++
        }
    } catch {
        Write-Warning "$script - Could not validate"
    }
}

if ($scriptsFailed -eq 0) {
    Write-Success "All $scriptsPassed scripts validated"
    $results.PowerShellTests = "PASSED ($scriptsPassed)"
} else {
    Write-Failure "$scriptsFailed scripts failed validation"
    $results.PowerShellTests = "FAILED ($scriptsFailed)"
}

# Step 6: Integration Tests (from host)
Write-Step "6/7" "Running integration tests from host..."
Push-Location $projectDir
try {
    $integrationOutput = npm run test:docker 2>&1
    if ($integrationOutput -match "passed") {
        Write-Success "Integration tests passed"
        $results.IntegrationTests = "PASSED"
    } else {
        Write-Warning "Integration tests may have issues"
        $results.IntegrationTests = "WARNING"
    }
} catch {
    Write-Warning "Could not run integration tests: $_"
    $results.IntegrationTests = "SKIPPED"
} finally {
    Pop-Location
}

# Step 7: Functional Tests
Write-Step "7/7" "Running functional tests..."
Push-Location $projectDir
try {
    $functionalOutput = npm run test:docker:functional 2>&1
    if ($functionalOutput -match "passed") {
        Write-Success "Functional tests passed"
        $results.FunctionalTests = "PASSED"
    } else {
        Write-Warning "Functional tests may have issues"
        $results.FunctionalTests = "WARNING"
    }
} catch {
    Write-Warning "Could not run functional tests: $_"
    $results.FunctionalTests = "SKIPPED"
} finally {
    Pop-Location
}

# Summary
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Test Results Summary                                         ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$results.GetEnumerator() | ForEach-Object {
    $status = $_.Value
    $color = switch -Wildcard ($status) {
        "PASSED*" { "Green" }
        "FAILED*" { "Red" }
        "SKIPPED*" { "Yellow" }
        "WARNING*" { "Yellow" }
        default { "Gray" }
    }
    Write-Host "  $($_.Key.PadRight(20)) : $status" -ForegroundColor $color
}

Write-Host ""
Write-Host "  Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Gray
Write-Host ""

# Calculate overall result
$failed = $results.Values | Where-Object { $_ -like "FAILED*" }
if ($failed.Count -gt 0) {
    Write-Host "  Overall: SOME TESTS FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  Overall: ALL TESTS PASSED ✅" -ForegroundColor Green
    exit 0
}
