# Quick Start Guide - Docker Environment

## 🚀 Fastest Way to Get Started

### Step 1: Start Docker Desktop
Make sure Docker Desktop is running on your machine.

### Step 2: Run Quick Start Script

**Windows:**
```powershell
cd docker
.\quick-start.ps1
```

**Linux/Mac:**
```bash
cd docker
chmod +x quick-start.sh
./quick-start.sh
```

### Step 3: Wait for Services
The script will:
- Check Docker is running
- Ask you to choose Linux or Windows containers
- Build and start all containers
- Show container status

**Wait 30-60 seconds** for services to initialize.

### Step 4: Access Application

```powershell
# Enter app container
docker exec -it ga-applocker-app powershell

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

### Step 5: Open in Browser
Navigate to: **http://localhost:3000**

## What You Get

- ✅ **Domain Controller** - Active Directory with test users
- ✅ **Windows Client** - WinRM-enabled for remote scanning
- ✅ **Application Container** - Full development environment

## Default Credentials

- **Domain:** `applocker.local`
- **Admin:** `Administrator` / `SecurePass123!`
- **Test User:** `testuser1` / `TestUser1@123`

## Quick Commands

```powershell
# View logs
docker compose logs -f

# Stop containers
docker compose down

# Restart containers
docker compose restart

# Run test suite
docker exec ga-applocker-app powershell -File docker/test-app.ps1

# Access app container
docker exec -it ga-applocker-app powershell
```

## Need Help?

See **SETUP_GUIDE.md** for detailed instructions and troubleshooting.
