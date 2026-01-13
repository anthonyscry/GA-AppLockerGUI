# Windows Server 2019 Docker Testing Guide

## Overview

This guide covers running comprehensive functionality tests in Windows Server 2019 containers with Active Directory for AppLocker testing.

## Prerequisites

1. **Windows 10/11 Pro/Enterprise** or **Windows Server 2019+**
2. **Docker Desktop** with Windows containers enabled
3. **PowerShell 5.1+** or **PowerShell 7+**
4. **Administrator privileges**

## Quick Start

### 1. Enable Windows Containers

```powershell
# Check if Windows containers are enabled
docker version

# If you see "OS/Arch: windows/amd64", you're good!
# If not, switch to Windows containers in Docker Desktop
```

### 2. Build and Run

```powershell
# Navigate to docker directory
cd docker

# Run all tests (build, start, test)
.\run-windows2019-tests.ps1 -All
```

## Manual Steps

### Build Containers

```powershell
docker-compose -f docker-compose.windows2019.yml build
```

### Start Containers

```powershell
docker-compose -f docker-compose.windows2019.yml up -d
```

### Wait for Services

```powershell
# Wait for AD DS to initialize (2-3 minutes)
Start-Sleep -Seconds 180

# Check container status
docker ps
```

### Run Tests

```powershell
# Run tests on client container
docker exec ga-applocker-client-2019 powershell -File C:\scripts\run-functionality-tests.ps1

# Or run tests on domain controller
docker exec ga-applocker-dc-2019 powershell -File C:\scripts\run-functionality-tests.ps1
```

### View Results

```powershell
# Copy results from container
docker cp ga-applocker-client-2019:C:\test-results .\test-results\client

# View HTML report
Start-Process .\test-results\client\test-results.html
```

## Test Coverage

### Domain Controller Tests

1. ✅ Domain exists and is accessible
2. ✅ DNS service running
3. ✅ AD DS service running
4. ✅ Test users created
5. ✅ Test groups created
6. ✅ PowerShell modules available
7. ✅ Network connectivity

### Client Tests

1. ✅ Domain join status
2. ✅ Domain controller reachable
3. ✅ WinRM service and connectivity
4. ✅ AppLocker module available
5. ✅ AppLocker policies accessible
6. ✅ Policy creation and export
7. ✅ Event log access
8. ✅ Group Policy module
9. ✅ File system operations

## Test Results

### JSON Format

Results are saved as JSON with:
- Test name
- Status (PASS/FAIL)
- Message
- Timestamp
- Summary statistics

### HTML Report

Visual HTML report with:
- Summary statistics
- Color-coded test results
- Pass rate percentage

## Container Details

### Domain Controller (dc-windows2019)

- **Image**: Windows Server Core 2019
- **Hostname**: DC01
- **Domain**: applocker.local
- **Ports**: 53, 88, 135, 389, 445, 464, 636, 3268, 3269

### Client (client-windows2019)

- **Image**: Windows Server Core 2019
- **Hostname**: CLIENT01
- **Domain**: applocker.local (joined)
- **Ports**: 5985 (WinRM HTTP), 5986 (WinRM HTTPS)

## Troubleshooting

### Containers won't start

```powershell
# Check Docker logs
docker-compose -f docker-compose.windows2019.yml logs

# Check if Windows containers are enabled
docker version
```

### Domain join fails

```powershell
# Check domain controller logs
docker logs ga-applocker-dc-2019

# Verify DNS resolution
docker exec ga-applocker-client-2019 nslookup DC01
```

### Tests fail

```powershell
# Check test logs
docker exec ga-applocker-client-2019 Get-Content C:\logs\*.log

# Run individual test functions
docker exec -it ga-applocker-client-2019 powershell
# Then: . C:\scripts\test-functions.ps1; Test-AppLocker
```

### WinRM not accessible

```powershell
# Check WinRM service
docker exec ga-applocker-client-2019 Get-Service WinRM

# Test WinRM connectivity
docker exec ga-applocker-client-2019 Test-WSMan
```

## Advanced Usage

### Run Specific Tests

```powershell
docker exec -it ga-applocker-client-2019 powershell
. C:\scripts\test-functions.ps1
Test-AppLocker
Test-WinRM
```

### Custom Test Script

Create your own test script:

```powershell
# custom-tests.ps1
. C:\scripts\test-functions.ps1

# Your custom tests here
Write-TestResult -TestName "Custom Test" -Passed $true -Message "Test passed"

Export-TestResults -OutputPath "C:\test-results\custom-results.json"
```

### Continuous Testing

```powershell
# Run tests every 5 minutes
while ($true) {
    docker exec ga-applocker-client-2019 powershell -File C:\scripts\run-functionality-tests.ps1
    Start-Sleep -Seconds 300
}
```

## Performance

- **Container startup**: ~2-3 minutes
- **AD DS initialization**: ~1-2 minutes
- **Test execution**: ~30-60 seconds
- **Total time**: ~5-6 minutes for full test suite

## Cleanup

```powershell
# Stop and remove containers
docker-compose -f docker-compose.windows2019.yml down

# Remove volumes (WARNING: Deletes all data)
docker-compose -f docker-compose.windows2019.yml down -v

# Remove images
docker rmi ga-applocker-dc-windows2019 ga-applocker-client-windows2019
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Windows 2019 Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: windows-2019
    steps:
      - uses: actions/checkout@v3
      - name: Build containers
        run: docker-compose -f docker/docker-compose.windows2019.yml build
      - name: Start containers
        run: docker-compose -f docker/docker-compose.windows2019.yml up -d
      - name: Wait for services
        run: Start-Sleep -Seconds 180
      - name: Run tests
        run: docker exec ga-applocker-client-2019 powershell -File C:\scripts\run-functionality-tests.ps1
      - name: Copy results
        run: docker cp ga-applocker-client-2019:C:\test-results ./test-results
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

*Last Updated: 2024*
