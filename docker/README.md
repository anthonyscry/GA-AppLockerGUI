# GA-AppLocker Lab Environment - Docker Setup

Complete Docker lab environment for testing the GA-AppLocker Dashboard application with Active Directory and AppLocker capabilities.

## Documentation

- **README.md** - Overview and quick reference (this file)
- **SETUP_GUIDE.md** - Detailed setup and usage guide
- **Makefile** - Convenient commands for managing containers

## Quick Start Scripts

- **quick-start.ps1** - PowerShell quick start
- **quick-start.sh** - Bash quick start
- **run.ps1** - Simple run script with options

## Quick Start

### Option 1: Quick Start Script (Easiest)

**PowerShell:**
```powershell
cd docker
.\quick-start.ps1
```

**Bash:**
```bash
cd docker
./quick-start.sh
```

### Option 2: Simple Run Script

```powershell
cd docker
.\run.ps1
```

With options:
```powershell
.\run.ps1 -Build              # Build before starting
.\run.ps1 -ComposeFile docker-compose.windows.yml  # Use Windows containers
```

### Option 3: Docker Compose

```powershell
cd docker
docker compose up -d
```

### Option 4: Makefile

```bash
cd docker
make start                    # Linux containers
make start COMPOSE_FILE=docker-compose.windows.yml  # Windows containers
```

## What You Get

### Domain Controller (`ga-applocker-dc`)
- Active Directory Domain Services
- DNS, LDAP, Kerberos
- Test users and groups pre-configured
- Domain: `applocker.local`

### Windows Client (`ga-applocker-client`)
- WinRM enabled for remote scanning
- Domain-joined
- Test applications directory
- AppLocker enabled (Windows containers)

### Application Container (`ga-applocker-app`)
- Node.js development environment
- All dependencies
- Application source code mounted
- Ready for development

## Important Notes

### For True AppLocker Testing

AppLocker is Windows-only. For full functionality:
1. Enable Windows containers in Docker Desktop
2. Use the Windows compose file:
   ```powershell
   docker compose -f docker-compose.windows.yml up -d
   ```

## Default Credentials

- **Domain:** `applocker.local`
- **Admin:** `Administrator` / `SecurePass123!`
- **Test Users:** 
  - `testuser1` / `TestUser1@123`
  - `testuser2` / `TestUser2@123`

## Common Commands

```powershell
# Start environment
.\run.ps1

# View logs
docker compose logs -f

# Stop environment
docker compose down

# Access app container
docker exec -it ga-applocker-app bash

# Run tests
make test-app
```

## Next Steps

1. Start the environment using one of the methods above
2. Wait for services to initialize (30-60 seconds)
3. Access the app container:
   ```powershell
   docker exec -it ga-applocker-app bash
   npm install
   npm run dev
   ```
4. Test AD integration, remote scanning, and AppLocker features

## Additional Resources

All files are in the `docker/` directory. See **SETUP_GUIDE.md** for detailed instructions and troubleshooting.
