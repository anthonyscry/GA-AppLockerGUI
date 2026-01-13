# Comprehensive Functionality Test Suite
# Runs all tests for AppLocker functionality in Windows Server 2019 container

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AppLocker Functionality Test Suite  " -ForegroundColor Cyan
Write-Host "  Windows Server 2019 Container        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Import test functions
. C:\scripts\test-functions.ps1

# Initialize test tracking
$script:TestResults = @()
$script:TestCount = 0
$script:PassCount = 0
$script:FailCount = 0

# Create results directory
$ResultsDir = "C:\test-results"
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
}

# Determine container role
$IsDomainController = $env:COMPUTERNAME -eq "DC01" -or $env:HOSTNAME -eq "DC01"
$IsClient = $env:COMPUTERNAME -eq "CLIENT01" -or $env:HOSTNAME -eq "CLIENT01"

Write-Host "Container Role Detection:" -ForegroundColor Yellow
Write-Host "  Computer Name: $env:COMPUTERNAME" -ForegroundColor White
Write-Host "  Hostname: $env:HOSTNAME" -ForegroundColor White
Write-Host "  Is Domain Controller: $IsDomainController" -ForegroundColor White
Write-Host "  Is Client: $IsClient" -ForegroundColor White
Write-Host ""

# Run tests based on container role
if ($IsDomainController) {
    Write-Host "Running Domain Controller Tests..." -ForegroundColor Green
    Test-DomainController
    Test-PowerShellModules
    Test-NetworkConnectivity
    Test-FileSystem
} elseif ($IsClient) {
    Write-Host "Running Client Tests..." -ForegroundColor Green
    
    # Wait for domain to be ready
    Write-Host "Waiting for domain to be ready..." -ForegroundColor Yellow
    $MaxWait = 60
    $WaitCount = 0
    $DomainReady = $false
    
    while (-not $DomainReady -and $WaitCount -lt $MaxWait) {
        try {
            Import-Module ActiveDirectory -ErrorAction Stop
            $Domain = Get-ADDomain -ErrorAction Stop
            $DomainReady = $true
            Write-Host "Domain is ready!" -ForegroundColor Green
        } catch {
            Start-Sleep -Seconds 2
            $WaitCount++
            Write-Host "Waiting for domain... ($WaitCount/$MaxWait)" -ForegroundColor Yellow
        }
    }
    
    # Run all client tests
    Test-DomainJoin
    Test-NetworkConnectivity
    Test-PowerShellModules
    Test-WinRM
    Test-AppLocker
    Test-AppLockerPolicyOperations
    Test-EventLog
    Test-GroupPolicy
    Test-FileSystem
} else {
    Write-Host "Running Generic Tests..." -ForegroundColor Green
    Test-NetworkConnectivity
    Test-FileSystem
    Test-PowerShellModules
}

# Export results
$Summary = Export-TestResults -OutputPath "$ResultsDir\functionality-test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

# Also create HTML report
$HtmlReport = @"
<!DOCTYPE html>
<html>
<head>
    <title>AppLocker Functionality Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .pass { background: #d4edda; border-left: 4px solid #28a745; }
        .fail { background: #f8d7da; border-left: 4px solid #dc3545; }
        .stats { display: flex; gap: 20px; }
        .stat { flex: 1; text-align: center; padding: 15px; background: #e9ecef; border-radius: 5px; }
        .stat-value { font-size: 2em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AppLocker Functionality Test Results</h1>
        <p>Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="stats">
            <div class="stat">
                <div class="stat-value" style="color: #333;">$($Summary.TotalTests)</div>
                <div>Total Tests</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #28a745;">$($Summary.Passed)</div>
                <div>Passed</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #dc3545;">$($Summary.Failed)</div>
                <div>Failed</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: $(if ($Summary.PassRate -ge 80) { '#28a745' } else { '#ffc107' });">$($Summary.PassRate)%</div>
                <div>Pass Rate</div>
            </div>
        </div>
    </div>
    
    <div class="summary">
        <h2>Test Results</h2>
"@

foreach ($Result in $Summary.Results) {
    $Class = if ($Result.Status -eq "PASS") { "pass" } else { "fail" }
    $HtmlReport += @"
        <div class="test $Class">
            <strong>[$($Result.Status)]</strong> $($Result.TestName)
            $(if ($Result.Message) { "<br><em>$($Result.Message)</em>" })
        </div>
"@
}

$HtmlReport += @"
    </div>
</body>
</html>
"@

$HtmlReport | Out-File -FilePath "$ResultsDir\test-results.html" -Encoding UTF8
Write-Host "HTML report saved to: $ResultsDir\test-results.html" -ForegroundColor Cyan

# Exit with appropriate code
if ($Summary.Failed -eq 0) {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSome tests failed. Check results for details." -ForegroundColor Yellow
    exit 1
}
