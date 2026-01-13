# 🚀 Docker Test Suite - START HERE

## Quick Start (3 Steps)

### Step 1: Validate Setup
```powershell
cd docker
.\validate-setup.ps1
```

This checks if Docker is installed and running.

### Step 2: Run Tests
```powershell
.\run-tests-enhanced.ps1
```

This will:
- Auto-detect Docker
- Start all containers
- Run comprehensive tests
- Show results

### Step 3: Access Application
```powershell
docker exec -it ga-applocker-app bash
cd /app
npm install
npm run dev
```

Then open: **http://localhost:3000**

## If Docker Isn't Installed

The test script will show you exactly what to do, but here's the quick version:

1. **Download Docker Desktop**: https://www.docker.com/products/docker-desktop
2. **Install** it
3. **Start** Docker Desktop (check system tray)
4. **Wait** for Docker to fully start (whale icon steady)
5. **Run** `.\run-tests-enhanced.ps1` again

## Test Scripts Available

| Script | Purpose |
|--------|---------|
| `validate-setup.ps1` | Pre-flight checks |
| `run-tests-enhanced.ps1` | **Full test suite (recommended)** |
| `QUICK_TEST.ps1` | Quick validation |
| `run-tests.ps1` | Original test script |

## What Gets Tested

✅ Docker installation and daemon  
✅ Docker Compose availability  
✅ Container startup and health  
✅ Node.js and npm versions  
✅ Application dependencies  
✅ React app build  
✅ TypeScript compilation  
✅ PowerShell scripts presence  
✅ Build output verification  

## Troubleshooting

**Docker not found?**
→ Run `validate-setup.ps1` for detailed diagnostics

**Containers won't start?**
→ Check Docker has enough resources (Settings > Resources)
→ Ensure ports 3000, 5173, 5985, 5986 are free

**Tests fail?**
→ Check logs: `docker compose logs`
→ Try: `docker compose down` then run again

---

**Ready?** Run `.\run-tests-enhanced.ps1` now! 🎉
