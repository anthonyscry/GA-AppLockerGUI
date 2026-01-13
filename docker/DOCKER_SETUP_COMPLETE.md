# Docker Setup - Complete Verification

## ✅ Setup Status

All Docker configuration files are in place and ready for use.

## Files Verified

### Core Configuration
- ✅ `docker-compose.yml` - Linux containers setup
- ✅ `docker-compose.windows.yml` - Windows containers setup
- ✅ `Dockerfile.app` - Application container (Linux)
- ✅ `Dockerfile.app.windows` - Application container (Windows)
- ✅ `Dockerfile.dc` - Domain Controller
- ✅ `Dockerfile.client` - Windows Client

### Scripts
- ✅ `quick-start.ps1` - PowerShell quick start
- ✅ `quick-start.sh` - Bash quick start
- ✅ `test-app.ps1` - Application test suite
- ✅ `Makefile` - Convenient commands

### Documentation
- ✅ `README.md` - Overview and quick reference
- ✅ `SETUP_GUIDE.md` - Detailed setup guide
- ✅ `TESTING_GUIDE.md` - Testing strategies

### Setup Scripts
- ✅ `scripts/setup-dc.sh` - Domain Controller setup (Linux)
- ✅ `scripts/setup-dc-windows.ps1` - Domain Controller setup (Windows)
- ✅ `scripts/setup-client.sh` - Client setup (Linux)
- ✅ `scripts/setup-client-windows.ps1` - Client setup (Windows)

## Quick Start Commands

### Option 1: Quick Start Script
```powershell
cd docker
.\quick-start.ps1
```

### Option 2: Docker Compose
```powershell
cd docker
docker compose up -d
```

### Option 3: Makefile
```bash
cd docker
make start
```

## Testing Workflow

### 1. Start Environment
```powershell
cd docker
docker compose up -d
```

### 2. Wait for Initialization (30-60 seconds)
```powershell
docker compose logs -f
```

### 3. Run Test Suite
```powershell
docker exec ga-applocker-app powershell -File docker/test-app.ps1
```

### 4. Access Application Container
```powershell
docker exec -it ga-applocker-app powershell
npm install
npm run dev
```

### 5. Test React App
- Access at: `http://localhost:3000`
- All UI components testable
- State management works
- Component interactions functional

### 6. Test PowerShell Scripts
```powershell
cd scripts
.\Test-RuleHealth.ps1
.\New-RulesFromInventory.ps1 -InventoryPath "test.csv" -OutputPath "test.xml"
```

## Container Architecture

```
┌─────────────────────────────────────────┐
│     Docker Network (172.20.0.0/16)     │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Domain       │  │ Windows      │   │
│  │ Controller   │◄─┤ Client       │   │
│  │ (DC01)       │  │ (CLIENT01)   │   │
│  └──────┬───────┘  └──────┬───────┘   │
│         │                 │            │
│         └────────┬────────┘            │
│                  │                     │
│         ┌────────┴──────────┐          │
│         │ Application       │          │
│         │ Container (APP01) │          │
│         └───────────────────┘          │
└─────────────────────────────────────────┘
```

## Default Credentials

- **Domain:** `applocker.local`
- **Admin:** `Administrator` / `SecurePass123!`
- **Test Users:**
  - `testuser1` / `TestUser1@123`
  - `testuser2` / `TestUser2@123`

## Port Mappings

### Domain Controller
- 53 (DNS)
- 88 (Kerberos)
- 389 (LDAP)
- 445 (SMB)
- 636 (LDAPS)
- 3268/3269 (Global Catalog)

### Windows Client
- 5985 (WinRM HTTP)
- 5986 (WinRM HTTPS)
- 3389 (RDP - Windows only)

### Application Container
- 3000 (Vite dev server)
- 5173 (Alternative Vite port)

## What Can Be Tested

### ✅ In Docker (Without GUI)
1. **React Application** - Full UI via browser
2. **PowerShell Scripts** - All `.ps1` scripts
3. **Build Process** - TypeScript compilation, Vite build
4. **AD Integration** - LDAP, user/group queries
5. **WinRM** - Remote scanning capabilities
6. **Service Layer** - Business logic, data processing

### ⚠️ Requires Local Testing
1. **Electron GUI** - Window rendering, native dialogs
2. **Full IPC Stack** - Requires Electron main process

## Next Steps

1. **Start Docker Desktop** (if not running)
2. **Enable Windows Containers** (for full AppLocker support)
3. **Run Quick Start Script** - `.\quick-start.ps1`
4. **Wait for Services** - 30-60 seconds initialization
5. **Run Tests** - `docker exec ga-applocker-app powershell -File docker/test-app.ps1`
6. **Start Dev Server** - `npm run dev` in container
7. **Access App** - `http://localhost:3000` in browser

## Troubleshooting

### Docker Not Running
- Start Docker Desktop
- Verify Docker is in PATH
- Check Docker service status

### Port Conflicts
- Check if ports 53, 88, 389, 445, 5985, 3000 are in use
- Modify port mappings in `docker-compose.yml` if needed

### Container Build Failures
```powershell
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Windows Containers Not Available
- Enable Windows containers in Docker Desktop
- Verify Hyper-V is enabled (Windows 10/11)
- Use Linux containers as fallback

## Status: ✅ READY

All Docker configuration is complete and ready for use. Simply start Docker Desktop and run the quick start script to begin testing.
