# 🚀 Run Docker Tests Now!

## Quick Start

```powershell
cd docker
.\run-tests-enhanced.ps1
```

## What This Does

The enhanced test script will:

1. ✅ **Auto-detect Docker** - Finds Docker even if not in PATH
2. ✅ **Check Docker is Running** - Verifies Docker Desktop is active
3. ✅ **Start Containers** - Builds and starts all services
4. ✅ **Wait for Services** - Ensures everything is ready
5. ✅ **Run Tests** - Executes comprehensive test suite
6. ✅ **Show Results** - Clear status for each test

## If Docker Isn't Found

The script will show you:
- Where to download Docker Desktop
- How to install it
- How to start it
- When to run the script again

## Test Options

### Full Test Suite (Recommended)
```powershell
.\run-tests-enhanced.ps1
```

### Quick Test (When Docker is Already Running)
```powershell
.\QUICK_TEST.ps1
```

### Original Test Script
```powershell
.\run-tests.ps1
```

## After Tests Pass

```powershell
# Access the app container
docker exec -it ga-applocker-app powershell

# Inside container:
cd C:\app  # or /app for Linux containers
npm install
npm run dev
```

Then open: **http://localhost:3000**

---

**Ready to test!** 🎉
