# Master Test Runner
# Orchestrates all functionality tests across containers

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Master Test Runner                   " -ForegroundColor Cyan
Write-Host "  Comprehensive Functionality Tests    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Import test functions
. C:\scripts\test-functions.ps1

# Run all tests
Write-Host "Running comprehensive test suite..." -ForegroundColor Green
Write-Host ""

# Determine container role and run appropriate tests
$IsDomainController = $env:COMPUTERNAME -eq "DC01" -or $env:HOSTNAME -eq "DC01"
$IsClient = $env:COMPUTERNAME -eq "CLIENT01" -or $env:HOSTNAME -eq "CLIENT01"

if ($IsDomainController) {
    Write-Host "=== DOMAIN CONTROLLER TESTS ===" -ForegroundColor Yellow
    Test-DomainController
    Test-PowerShellModules
    Test-NetworkConnectivity
    Test-FileSystem
} elseif ($IsClient) {
    Write-Host "=== CLIENT TESTS ===" -ForegroundColor Yellow
    
    # Wait for domain
    Write-Host "Waiting for domain..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    Test-DomainJoin
    Test-NetworkConnectivity
    Test-PowerShellModules
    Test-WinRM
    Test-AppLocker
    Test-AppLockerPolicyOperations
    Test-EventLog
    Test-GroupPolicy
    Test-FileSystem
}

# Export results
$ResultsPath = "C:\test-results\all-tests-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$Summary = Export-TestResults -OutputPath $ResultsPath

# Return exit code
if ($Summary.Failed -eq 0) {
    exit 0
} else {
    exit 1
}
