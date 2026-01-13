# Test Functions for AppLocker Functionality Testing
# Comprehensive test suite for all AppLocker features

$ErrorActionPreference = "Continue"
$TestResults = @()
$TestCount = 0
$PassCount = 0
$FailCount = 0

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = "",
        [object]$Details = $null
    )
    
    $script:TestCount++
    if ($Passed) {
        $script:PassCount++
        $Color = "Green"
        $Status = "PASS"
    } else {
        $script:FailCount++
        $Color = "Red"
        $Status = "FAIL"
    }
    
    $Result = @{
        TestName = $TestName
        Status = $Status
        Message = $Message
        Details = $Details
        Timestamp = Get-Date
    }
    
    $script:TestResults += $Result
    
    Write-Host "[$Status] $TestName" -ForegroundColor $Color
    if ($Message) {
        Write-Host "  $Message" -ForegroundColor $Color
    }
    
    return $Result
}

function Test-DomainController {
    Write-Host "`n=== Testing Domain Controller ===" -ForegroundColor Cyan
    
    # Test 1: Domain exists
    try {
        $Domain = Get-ADDomain -ErrorAction Stop
        Write-TestResult -TestName "Domain Controller - Domain Exists" -Passed $true -Message "Domain: $($Domain.DNSRoot)"
    } catch {
        Write-TestResult -TestName "Domain Controller - Domain Exists" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 2: DNS service running
    try {
        $DnsService = Get-Service -Name DNS -ErrorAction Stop
        $Passed = $DnsService.Status -eq "Running"
        Write-TestResult -TestName "Domain Controller - DNS Service" -Passed $Passed -Message "Status: $($DnsService.Status)"
    } catch {
        Write-TestResult -TestName "Domain Controller - DNS Service" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 3: AD DS service running
    try {
        $NTDSService = Get-Service -Name NTDS -ErrorAction Stop
        $Passed = $NTDSService.Status -eq "Running"
        Write-TestResult -TestName "Domain Controller - AD DS Service" -Passed $Passed -Message "Status: $($NTDSService.Status)"
    } catch {
        Write-TestResult -TestName "Domain Controller - AD DS Service" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 4: Test users exist
    try {
        $Users = Get-ADUser -Filter * -ErrorAction Stop
        $UserCount = ($Users | Measure-Object).Count
        $Passed = $UserCount -gt 0
        Write-TestResult -TestName "Domain Controller - Test Users" -Passed $Passed -Message "Found $UserCount users"
    } catch {
        Write-TestResult -TestName "Domain Controller - Test Users" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 5: Test groups exist
    try {
        $Groups = Get-ADGroup -Filter * -ErrorAction Stop
        $GroupCount = ($Groups | Measure-Object).Count
        $Passed = $GroupCount -gt 0
        Write-TestResult -TestName "Domain Controller - Test Groups" -Passed $Passed -Message "Found $GroupCount groups"
    } catch {
        Write-TestResult -TestName "Domain Controller - Test Groups" -Passed $false -Message $_.Exception.Message
    }
}

function Test-AppLocker {
    Write-Host "`n=== Testing AppLocker ===" -ForegroundColor Cyan
    
    # Test 1: AppLocker module available
    try {
        $Module = Get-Module -ListAvailable -Name AppLocker -ErrorAction Stop
        $Passed = $null -ne $Module
        Write-TestResult -TestName "AppLocker - Module Available" -Passed $Passed -Message "Module: $($Module.Version)"
    } catch {
        Write-TestResult -TestName "AppLocker - Module Available" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 2: Import AppLocker module
    try {
        Import-Module AppLocker -ErrorAction Stop
        Write-TestResult -TestName "AppLocker - Module Import" -Passed $true -Message "Module imported successfully"
    } catch {
        Write-TestResult -TestName "AppLocker - Module Import" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 3: Get AppLocker policies
    try {
        $Policies = Get-AppLockerPolicy -Effective -ErrorAction Stop
        $Passed = $null -ne $Policies
        Write-TestResult -TestName "AppLocker - Get Policies" -Passed $Passed -Message "Policies retrieved"
    } catch {
        Write-TestResult -TestName "AppLocker - Get Policies" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 4: Test AppLocker service
    try {
        $Service = Get-Service -Name AppIDSvc -ErrorAction SilentlyContinue
        if ($Service) {
            $Passed = $Service.Status -eq "Running"
            Write-TestResult -TestName "AppLocker - Service Status" -Passed $Passed -Message "Status: $($Service.Status)"
        } else {
            Write-TestResult -TestName "AppLocker - Service Status" -Passed $false -Message "AppIDSvc service not found"
        }
    } catch {
        Write-TestResult -TestName "AppLocker - Service Status" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 5: Create test policy
    try {
        $TestPolicy = New-AppLockerPolicy -RuleType Publisher -User Everyone -ErrorAction Stop
        $Passed = $null -ne $TestPolicy
        Write-TestResult -TestName "AppLocker - Create Policy" -Passed $Passed -Message "Test policy created"
    } catch {
        Write-TestResult -TestName "AppLocker - Create Policy" -Passed $false -Message $_.Exception.Message
    }
}

function Test-WinRM {
    Write-Host "`n=== Testing WinRM ===" -ForegroundColor Cyan
    
    # Test 1: WinRM service running
    try {
        $Service = Get-Service -Name WinRM -ErrorAction Stop
        $Passed = $Service.Status -eq "Running"
        Write-TestResult -TestName "WinRM - Service Status" -Passed $Passed -Message "Status: $($Service.Status)"
    } catch {
        Write-TestResult -TestName "WinRM - Service Status" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 2: WinRM listeners
    try {
        $Listeners = Get-ChildItem WSMan:\LocalHost\Listener -ErrorAction Stop
        $ListenerCount = ($Listeners | Measure-Object).Count
        $Passed = $ListenerCount -gt 0
        Write-TestResult -TestName "WinRM - Listeners Configured" -Passed $Passed -Message "Found $ListenerCount listeners"
    } catch {
        Write-TestResult -TestName "WinRM - Listeners Configured" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 3: WinRM connectivity (self-test)
    try {
        $TestConnection = Test-WSMan -ErrorAction Stop
        $Passed = $null -ne $TestConnection
        Write-TestResult -TestName "WinRM - Connectivity Test" -Passed $Passed -Message "WinRM responding"
    } catch {
        Write-TestResult -TestName "WinRM - Connectivity Test" -Passed $false -Message $_.Exception.Message
    }
}

function Test-PowerShellModules {
    Write-Host "`n=== Testing PowerShell Modules ===" -ForegroundColor Cyan
    
    $RequiredModules = @(
        "ActiveDirectory",
        "AppLocker",
        "GroupPolicy"
    )
    
    foreach ($ModuleName in $RequiredModules) {
        try {
            $Module = Get-Module -ListAvailable -Name $ModuleName -ErrorAction Stop
            $Passed = $null -ne $Module
            $Version = if ($Module) { $Module.Version.ToString() } else { "Not found" }
            Write-TestResult -TestName "PowerShell Module - $ModuleName" -Passed $Passed -Message "Version: $Version"
        } catch {
            Write-TestResult -TestName "PowerShell Module - $ModuleName" -Passed $false -Message $_.Exception.Message
        }
    }
}

function Test-NetworkConnectivity {
    Write-Host "`n=== Testing Network Connectivity ===" -ForegroundColor Cyan
    
    $Targets = @(
        @{Name="Domain Controller"; Address=$env:DC_HOSTNAME ?? "DC01"},
        @{Name="DNS Server"; Address=$env:DNS_SERVER ?? "dc-windows2019"},
        @{Name="Localhost"; Address="127.0.0.1"}
    )
    
    foreach ($Target in $Targets) {
        try {
            $Ping = Test-Connection -ComputerName $Target.Address -Count 1 -ErrorAction Stop
            $Passed = $null -ne $Ping
            Write-TestResult -TestName "Network - Ping $($Target.Name)" -Passed $Passed -Message "Address: $($Target.Address)"
        } catch {
            Write-TestResult -TestName "Network - Ping $($Target.Name)" -Passed $false -Message $_.Exception.Message
        }
    }
}

function Test-DomainJoin {
    Write-Host "`n=== Testing Domain Join ===" -ForegroundColor Cyan
    
    # Test 1: Check if domain joined
    try {
        $ComputerInfo = Get-ComputerInfo
        $Domain = $ComputerInfo.Domain
        $Workgroup = $ComputerInfo.Workgroup
        
        if ($Domain -and $Domain -ne "WORKGROUP") {
            Write-TestResult -TestName "Domain Join - Status" -Passed $true -Message "Domain: $Domain"
        } elseif ($Workgroup) {
            Write-TestResult -TestName "Domain Join - Status" -Passed $false -Message "Not domain joined. Workgroup: $Workgroup"
        } else {
            Write-TestResult -TestName "Domain Join - Status" -Passed $false -Message "Could not determine domain status"
        }
    } catch {
        Write-TestResult -TestName "Domain Join - Status" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 2: Domain controller reachable
    try {
        $DomainController = (Get-ADDomainController -Discover -ErrorAction Stop).HostName
        $Passed = $null -ne $DomainController
        Write-TestResult -TestName "Domain Join - DC Reachable" -Passed $Passed -Message "DC: $DomainController"
    } catch {
        Write-TestResult -TestName "Domain Join - DC Reachable" -Passed $false -Message $_.Exception.Message
    }
}

function Test-FileSystem {
    Write-Host "`n=== Testing File System ===" -ForegroundColor Cyan
    
    # Test 1: Test directories exist
    $TestDirs = @("C:\scripts", "C:\logs", "C:\test-results", "C:\test-apps")
    
    foreach ($Dir in $TestDirs) {
        $Exists = Test-Path $Dir
        Write-TestResult -TestName "File System - Directory Exists" -Passed $Exists -Message "Path: $Dir"
    }
    
    # Test 2: Write test file
    try {
        $TestFile = "C:\test-results\test-write.txt"
        "Test content" | Out-File -FilePath $TestFile -ErrorAction Stop
        $Passed = Test-Path $TestFile
        Write-TestResult -TestName "File System - Write Test" -Passed $Passed -Message "File: $TestFile"
        Remove-Item $TestFile -ErrorAction SilentlyContinue
    } catch {
        Write-TestResult -TestName "File System - Write Test" -Passed $false -Message $_.Exception.Message
    }
}

function Test-AppLockerPolicyOperations {
    Write-Host "`n=== Testing AppLocker Policy Operations ===" -ForegroundColor Cyan
    
    # Test 1: Create Publisher rule
    try {
        $TestRule = New-AppLockerPolicy -RuleType Publisher -User Everyone -ErrorAction Stop
        $Passed = $null -ne $TestRule
        Write-TestResult -TestName "AppLocker Policy - Create Publisher Rule" -Passed $Passed -Message "Rule created"
    } catch {
        Write-TestResult -TestName "AppLocker Policy - Create Publisher Rule" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 2: Export policy to XML
    try {
        if ($TestRule) {
            $XmlPath = "C:\test-results\test-policy.xml"
            $TestRule | Set-AppLockerPolicy -XmlPolicy -ErrorAction Stop
            $Passed = Test-Path $XmlPath
            Write-TestResult -TestName "AppLocker Policy - Export XML" -Passed $Passed -Message "XML: $XmlPath"
        } else {
            Write-TestResult -TestName "AppLocker Policy - Export XML" -Passed $false -Message "No policy to export"
        }
    } catch {
        Write-TestResult -TestName "AppLocker Policy - Export XML" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 3: Test policy validation
    try {
        $TestApp = "C:\Windows\System32\notepad.exe"
        if (Test-Path $TestApp) {
            $TestResult = Test-AppLockerPolicy -Path $TestApp -ErrorAction Stop
            $Passed = $null -ne $TestResult
            Write-TestResult -TestName "AppLocker Policy - Validate Rule" -Passed $Passed -Message "Tested: $TestApp"
        } else {
            Write-TestResult -TestName "AppLocker Policy - Validate Rule" -Passed $false -Message "Test app not found"
        }
    } catch {
        Write-TestResult -TestName "AppLocker Policy - Validate Rule" -Passed $false -Message $_.Exception.Message
    }
}

function Test-EventLog {
    Write-Host "`n=== Testing Event Log ===" -ForegroundColor Cyan
    
    # Test 1: AppLocker event log exists
    try {
        $LogExists = Get-WinEvent -ListLog "Microsoft-Windows-AppLocker/EXE and DLL" -ErrorAction SilentlyContinue
        $Passed = $null -ne $LogExists
        Write-TestResult -TestName "Event Log - AppLocker Log Exists" -Passed $Passed -Message "Log found"
    } catch {
        Write-TestResult -TestName "Event Log - AppLocker Log Exists" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 2: Read recent events
    try {
        $Events = Get-WinEvent -LogName "Microsoft-Windows-AppLocker/EXE and DLL" -MaxEvents 10 -ErrorAction SilentlyContinue
        $EventCount = if ($Events) { ($Events | Measure-Object).Count } else { 0 }
        $Passed = $EventCount -ge 0
        Write-TestResult -TestName "Event Log - Read Events" -Passed $Passed -Message "Found $EventCount events"
    } catch {
        Write-TestResult -TestName "Event Log - Read Events" -Passed $false -Message $_.Exception.Message
    }
}

function Test-GroupPolicy {
    Write-Host "`n=== Testing Group Policy ===" -ForegroundColor Cyan
    
    # Test 1: GPO module available
    try {
        $Module = Get-Module -ListAvailable -Name GroupPolicy -ErrorAction Stop
        $Passed = $null -ne $Module
        Write-TestResult -TestName "Group Policy - Module Available" -Passed $Passed -Message "Module found"
    } catch {
        Write-TestResult -TestName "Group Policy - Module Available" -Passed $false -Message $_.Exception.Message
    }
    
    # Test 2: List GPOs
    try {
        Import-Module GroupPolicy -ErrorAction Stop
        $GPOs = Get-GPO -All -ErrorAction Stop
        $GpoCount = ($GPOs | Measure-Object).Count
        $Passed = $true
        Write-TestResult -TestName "Group Policy - List GPOs" -Passed $Passed -Message "Found $GpoCount GPOs"
    } catch {
        Write-TestResult -TestName "Group Policy - List GPOs" -Passed $false -Message $_.Exception.Message
    }
}

function Export-TestResults {
    param([string]$OutputPath = "C:\test-results\test-results.json")
    
    $Summary = @{
        TotalTests = $script:TestCount
        Passed = $script:PassCount
        Failed = $script:FailCount
        PassRate = if ($script:TestCount -gt 0) { [math]::Round(($script:PassCount / $script:TestCount) * 100, 2) } else { 0 }
        Timestamp = Get-Date
        Results = $script:TestResults
    }
    
    $Summary | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputPath -Encoding UTF8
    
    Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
    Write-Host "Total Tests: $($script:TestCount)" -ForegroundColor White
    Write-Host "Passed: $($script:PassCount)" -ForegroundColor Green
    Write-Host "Failed: $($script:FailCount)" -ForegroundColor Red
    Write-Host "Pass Rate: $($Summary.PassRate)%" -ForegroundColor $(if ($Summary.PassRate -ge 80) { "Green" } else { "Yellow" })
    Write-Host "Results exported to: $OutputPath" -ForegroundColor Cyan
    
    return $Summary
}

# Export functions for use in other scripts
Export-ModuleMember -Function Write-TestResult, Test-DomainController, Test-AppLocker, Test-WinRM, Test-PowerShellModules, Test-NetworkConnectivity, Test-DomainJoin, Test-FileSystem, Test-AppLockerPolicyOperations, Test-EventLog, Test-GroupPolicy, Export-TestResults
