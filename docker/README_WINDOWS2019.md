# Windows Server 2019 Docker Testing - Quick Reference

## 🚀 Quick Start

```powershell
cd docker
.\run-windows2019-tests.ps1 -All
```

This will:
1. Build Windows Server 2019 containers
2. Start domain controller and client
3. Run comprehensive functionality tests
4. Generate test reports

## 📋 Test Coverage

### Domain Controller Tests (10+ tests)
- Domain creation and configuration
- DNS service
- AD DS service
- User and group creation
- PowerShell modules
- Network connectivity

### Client Tests (20+ tests)
- Domain join verification
- WinRM configuration
- AppLocker module and policies
- Policy creation and export
- Event log access
- Group Policy integration
- File system operations

## 📊 Test Results

Results are saved to:
- `.\test-results\client-results\` - Client test results
- `.\test-results\dc-results\` - Domain controller test results

Formats:
- JSON: Detailed test data
- HTML: Visual report with pass/fail status

## 🔧 Commands

```powershell
# Build only
.\run-windows2019-tests.ps1 -Build

# Start containers
.\run-windows2019-tests.ps1 -Up

# Run tests
.\run-windows2019-tests.ps1 -Test

# View logs
.\run-windows2019-tests.ps1 -Logs

# Stop containers
.\run-windows2019-tests.ps1 -Down
```

## 📝 Requirements

- Windows 10/11 Pro/Enterprise or Windows Server 2019+
- Docker Desktop with Windows containers enabled
- PowerShell 5.1+
- Administrator privileges

## 🐛 Troubleshooting

See `TESTING_WINDOWS2019.md` for detailed troubleshooting guide.

---

*For detailed documentation, see TESTING_WINDOWS2019.md*
