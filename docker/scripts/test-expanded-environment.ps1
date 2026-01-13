# Comprehensive Test Script for Expanded Docker Environment
# Tests: Primary DC, Backup DC, Multiple Member Servers, 40 Users, Groups

$ErrorActionPreference = "Continue"

Write-Host "=== Expanded Environment Test Suite ===" -ForegroundColor Green
Write-Host "Testing: Primary DC, Backup DC, Member Servers, Users, Groups" -ForegroundColor Cyan

# Source test functions
. C:\scripts\test-functions.ps1

$TestResults = @()
$StartTime = Get-Date

# ============================================
# Domain Controller Tests
# ============================================
Write-Host "`n=== Testing Primary Domain Controller ===" -ForegroundColor Yellow

$TestResults += Write-TestResult -TestName "Primary DC - Domain Exists" -Passed $true -Message "Testing domain existence"
try {
    $Domain = Get-ADDomain -ErrorAction Stop
    $TestResults[-1].Passed = $true
    $TestResults[-1].Message = "Domain found: $($Domain.DNSRoot)"
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "Domain not found: $_"
}

$TestResults += Write-TestResult -TestName "Primary DC - DNS Service" -Passed $true -Message "Testing DNS service"
try {
    $DnsService = Get-Service DNS -ErrorAction Stop
    if ($DnsService.Status -eq "Running") {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "DNS service is running"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "DNS service is not running"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "DNS service check failed: $_"
}

# ============================================
# Backup DC Tests
# ============================================
Write-Host "`n=== Testing Backup Domain Controller ===" -ForegroundColor Yellow

$TestResults += Write-TestResult -TestName "Backup DC - Domain Controller Status" -Passed $true -Message "Testing backup DC status"
try {
    $BackupDC = Get-ADDomainController -Filter * | Where-Object { $_.Name -ne "DC01" } | Select-Object -First 1
    if ($BackupDC) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "Backup DC found: $($BackupDC.Name)"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Backup DC not found"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "Backup DC check failed: $_"
}

$TestResults += Write-TestResult -TestName "Backup DC - Replication Status" -Passed $true -Message "Testing replication"
try {
    $Replication = Get-ADReplicationPartnerMetadata -Target DC02 -ErrorAction SilentlyContinue
    if ($Replication) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "Replication partner found"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Replication partner not found"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "Replication check failed: $_"
}

# ============================================
# User and Group Tests
# ============================================
Write-Host "`n=== Testing Users and Groups ===" -ForegroundColor Yellow

$TestResults += Write-TestResult -TestName "Users - Total Count" -Passed $true -Message "Testing user count"
try {
    $AllUsers = Get-ADUser -Filter * -ErrorAction Stop
    $UserCount = ($AllUsers | Measure-Object).Count
    if ($UserCount -ge 40) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "Found $UserCount users (expected >= 40)"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Found only $UserCount users (expected >= 40)"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "User count check failed: $_"
}

$TestResults += Write-TestResult -TestName "Users - Department Distribution" -Passed $true -Message "Testing department distribution"
try {
    $Departments = @("IT", "Finance", "HR", "Engineering", "Sales", "Marketing", "Operations", "Security")
    $DeptCount = 0
    foreach ($Dept in $Departments) {
        $DeptUsers = Get-ADUser -Filter "Department -eq '$Dept'" -ErrorAction SilentlyContinue
        if ($DeptUsers) { $DeptCount++ }
    }
    if ($DeptCount -ge 6) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "Users found in $DeptCount departments"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Users found in only $DeptCount departments"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "Department check failed: $_"
}

$TestResults += Write-TestResult -TestName "Groups - Security Groups Count" -Passed $true -Message "Testing security groups"
try {
    $SecurityGroups = Get-ADGroup -Filter "GroupCategory -eq 'Security'" -ErrorAction Stop
    $GroupCount = ($SecurityGroups | Measure-Object).Count
    if ($GroupCount -ge 20) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "Found $GroupCount security groups (expected >= 20)"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Found only $GroupCount security groups (expected >= 20)"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "Group count check failed: $_"
}

$TestResults += Write-TestResult -TestName "Groups - AppLocker Groups" -Passed $true -Message "Testing AppLocker groups"
try {
    $AppLockerGroups = @("AppLocker-Users", "AppLocker-Admins", "AppLocker-Exe-Allow", "AppLocker-Exe-Deny")
    $FoundGroups = 0
    foreach ($GroupName in $AppLockerGroups) {
        $Group = Get-ADGroup -Filter "Name -eq '$GroupName'" -ErrorAction SilentlyContinue
        if ($Group) { $FoundGroups++ }
    }
    if ($FoundGroups -ge 3) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "Found $FoundGroups AppLocker groups"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Found only $FoundGroups AppLocker groups"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "AppLocker groups check failed: $_"
}

$TestResults += Write-TestResult -TestName "Users - Group Membership" -Passed $true -Message "Testing user group membership"
try {
    $SampleUsers = Get-ADUser -Filter * -Properties MemberOf | Select-Object -First 10
    $UsersWithGroups = ($SampleUsers | Where-Object { $_.MemberOf.Count -gt 0 }).Count
    if ($UsersWithGroups -ge 8) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "$UsersWithGroups of 10 sample users have group memberships"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Only $UsersWithGroups of 10 sample users have group memberships"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "Group membership check failed: $_"
}

# ============================================
# Organizational Unit Tests
# ============================================
Write-Host "`n=== Testing Organizational Units ===" -ForegroundColor Yellow

$TestResults += Write-TestResult -TestName "OUs - Department OUs" -Passed $true -Message "Testing department OUs"
try {
    $ExpectedOUs = @("IT", "Finance", "HR", "Engineering", "Sales", "Marketing", "Operations", "Security")
    $FoundOUs = 0
    foreach ($OUName in $ExpectedOUs) {
        $OU = Get-ADOrganizationalUnit -Filter "Name -eq '$OUName'" -ErrorAction SilentlyContinue
        if ($OU) { $FoundOUs++ }
    }
    if ($FoundOUs -ge 6) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "Found $FoundOUs department OUs"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Found only $FoundOUs department OUs"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "OU check failed: $_"
}

# ============================================
# Member Server Tests
# ============================================
Write-Host "`n=== Testing Member Servers ===" -ForegroundColor Yellow

$MemberServers = @("FILESERVER01", "APPSERVER01", "WEBSERVER01", "DBSERVER01")

foreach ($ServerName in $MemberServers) {
    $TestResults += Write-TestResult -TestName "Member Server - $ServerName Connectivity" -Passed $true -Message "Testing $ServerName"
    try {
        $TestConnection = Test-Connection -ComputerName $ServerName -Count 1 -ErrorAction SilentlyContinue
        if ($TestConnection) {
            $TestResults[-1].Passed = $true
            $TestResults[-1].Message = "$ServerName is reachable"
        } else {
            $TestResults[-1].Passed = $false
            $TestResults[-1].Message = "$ServerName is not reachable"
        }
    } catch {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "$ServerName connectivity test failed: $_"
    }
    
    $TestResults += Write-TestResult -TestName "Member Server - $ServerName Domain Join" -Passed $true -Message "Testing $ServerName domain join"
    try {
        $Computer = Get-ADComputer -Filter "Name -eq '$ServerName'" -ErrorAction SilentlyContinue
        if ($Computer) {
            $TestResults[-1].Passed = $true
            $TestResults[-1].Message = "$ServerName is joined to domain"
        } else {
            $TestResults[-1].Passed = $false
            $TestResults[-1].Message = "$ServerName is not found in AD"
        }
    } catch {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "$ServerName domain join check failed: $_"
    }
}

# ============================================
# Network Connectivity Tests
# ============================================
Write-Host "`n=== Testing Network Connectivity ===" -ForegroundColor Yellow

$TestResults += Write-TestResult -TestName "Network - All Servers Reachable" -Passed $true -Message "Testing network connectivity"
try {
    $AllServers = @("DC01", "DC02", "CLIENT01", "FILESERVER01", "APPSERVER01", "WEBSERVER01", "DBSERVER01")
    $ReachableCount = 0
    foreach ($Server in $AllServers) {
        $TestConnection = Test-Connection -ComputerName $Server -Count 1 -ErrorAction SilentlyContinue
        if ($TestConnection) { $ReachableCount++ }
    }
    if ($ReachableCount -ge 6) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "$ReachableCount of $($AllServers.Count) servers are reachable"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "Only $ReachableCount of $($AllServers.Count) servers are reachable"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "Network connectivity test failed: $_"
}

# ============================================
# DNS Tests
# ============================================
Write-Host "`n=== Testing DNS ===" -ForegroundColor Yellow

$TestResults += Write-TestResult -TestName "DNS - Resolution from Both DCs" -Passed $true -Message "Testing DNS resolution"
try {
    $TestHosts = @("DC01", "DC02", "CLIENT01")
    $ResolvedCount = 0
    foreach ($Host in $TestHosts) {
        $Resolved = Resolve-DnsName -Name "$Host.applocker.local" -ErrorAction SilentlyContinue
        if ($Resolved) { $ResolvedCount++ }
    }
    if ($ResolvedCount -ge 2) {
        $TestResults[-1].Passed = $true
        $TestResults[-1].Message = "DNS resolution working for $ResolvedCount hosts"
    } else {
        $TestResults[-1].Passed = $false
        $TestResults[-1].Message = "DNS resolution working for only $ResolvedCount hosts"
    }
} catch {
    $TestResults[-1].Passed = $false
    $TestResults[-1].Message = "DNS resolution test failed: $_"
}

# ============================================
# Summary
# ============================================
$EndTime = Get-Date
$Duration = $EndTime - $StartTime

$PassedTests = ($TestResults | Where-Object { $_.Passed -eq $true }).Count
$FailedTests = ($TestResults | Where-Object { $_.Passed -eq $false }).Count
$TotalTests = $TestResults.Count
$PassRate = if ($TotalTests -gt 0) { [math]::Round(($PassedTests / $TotalTests) * 100, 2) } else { 0 }

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Total Tests: $TotalTests" -ForegroundColor White
Write-Host "Passed: $PassedTests" -ForegroundColor Green
Write-Host "Failed: $FailedTests" -ForegroundColor Red
Write-Host "Pass Rate: $PassRate%" -ForegroundColor $(if ($PassRate -ge 80) { "Green" } else { "Yellow" })
Write-Host "Duration: $($Duration.TotalSeconds) seconds" -ForegroundColor White

# Export results
Export-TestResults -TestResults $TestResults -OutputPath "C:\test-results\expanded-environment-test-results.json"

Write-Host "`nTest results exported to: C:\test-results\expanded-environment-test-results.json" -ForegroundColor Cyan

if ($FailedTests -gt 0) {
    Write-Host "`nWARNING: Some tests failed. Review the results above." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
    exit 0
}
