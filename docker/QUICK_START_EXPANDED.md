# Quick Start - Expanded Environment

## 🚀 One Command to Rule Them All

```powershell
cd docker
.\run-expanded-tests.ps1 -All
```

This single command will:
1. ✅ Build all 7 containers
2. ✅ Start them in the correct order
3. ✅ Wait for services to initialize
4. ✅ Create 40+ users and 20+ groups
5. ✅ Run comprehensive tests
6. ✅ Copy all test results

## 📋 What You Get

### Infrastructure
- **Primary DC** (DC01) - Domain controller
- **Backup DC** (DC02) - Redundant domain controller
- **Client** (CLIENT01) - Workstation for testing
- **4 Member Servers**:
  - FILESERVER01
  - APPSERVER01
  - WEBSERVER01
  - DBSERVER01

### Users & Groups
- **40+ Users** across 8 departments:
  - IT, Finance, HR, Engineering, Sales, Marketing, Operations, Security
- **20+ Security Groups**:
  - Department groups (Users, Managers, Admins)
  - AppLocker groups (Users, Admins, Allow/Deny rules)

## ⚡ Quick Commands

### Start Environment
```powershell
.\run-expanded-tests.ps1 -Up
```

### Run Tests Only
```powershell
.\run-expanded-tests.ps1 -Test
```

### Create Users Only
```powershell
.\run-expanded-tests.ps1 -UsersOnly
```

### View Logs
```powershell
.\run-expanded-tests.ps1 -Logs
```

### Stop Environment
```powershell
.\run-expanded-tests.ps1 -Down
```

## 🔍 Verify Setup

### Check All Containers
```powershell
docker ps
```

### Check Users
```powershell
docker exec ga-applocker-dc-2019 powershell "Get-ADUser -Filter * | Measure-Object | Select-Object Count"
```

### Check Groups
```powershell
docker exec ga-applocker-dc-2019 powershell "Get-ADGroup -Filter * | Measure-Object | Select-Object Count"
```

### Test Domain Join
```powershell
docker exec ga-applocker-member-01-2019 powershell "(Get-WmiObject Win32_ComputerSystem).Domain"
```

## 📊 Test Results

Results are saved to: `.\test-results-expanded\`

- JSON test results
- HTML reports
- User export CSV
- Log files from all containers

## 🐛 Troubleshooting

### Containers won't start?
```powershell
docker-compose -f docker-compose.windows2019-expanded.yml logs
```

### Users not created?
```powershell
docker exec ga-applocker-dc-2019 powershell -File C:\scripts\create-users-and-groups.ps1
```

### Member servers not joining?
```powershell
docker logs ga-applocker-member-01-2019
```

## 📚 Full Documentation

See `EXPANDED_ENVIRONMENT_GUIDE.md` for complete details.

---

**Time to Setup**: ~15-20 minutes  
**Time to Test**: ~2-5 minutes  
**Total Time**: ~20-25 minutes
