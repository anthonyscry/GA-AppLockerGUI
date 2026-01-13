# GA-AppLocker Lab Environment - Setup Guide

## Overview

This Docker lab environment provides a complete testing setup for the GA-AppLocker Dashboard application. It includes:

- **Active Directory Domain Controller** - For testing AD integration
- **Windows Client** - For testing remote scanning and AppLocker policies
- **Application Development Container** - For building and testing the application

## Quick Start

### Option 1: Using Quick Start Scripts

**Windows (PowerShell):**
```powershell
cd docker
.\quick-start.ps1
```

**Linux/Mac (Bash):**
```bash
cd docker
chmod +x quick-start.sh
./quick-start.sh
```

### Option 2: Using Docker Compose Directly

**Linux Containers (AD Simulation):**
```bash
cd docker
docker compose up -d
```

**Windows Containers (Full AppLocker Support):**
```bash
cd docker
docker compose -f docker-compose.windows.yml up -d
```

### Option 3: Using Makefile

```bash
cd docker
make start                    # Linux containers
make start COMPOSE_FILE=docker-compose.windows.yml  # Windows containers
```

## Prerequisites

### For Linux Containers
- Docker Desktop or Docker Engine
- Docker Compose v2.0+
- 4GB+ RAM
- 10GB+ disk space

### For Windows Containers (Recommended)
- Windows 10/11 Pro/Enterprise or Windows Server 2019+
- Docker Desktop with Windows containers enabled
- Hyper-V enabled (Windows 10/11)
- 8GB+ RAM
- 20GB+ disk space

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Docker Network (172.20.0.0/16)        │
│                                                 │
│  ┌──────────────┐    ┌──────────────┐         │
│  │ Domain       │    │ Windows      │         │
│  │ Controller   │◄───┤ Client       │         │
│  │ (DC01)       │    │ (CLIENT01)   │         │
│  │              │    │              │         │
│  │ - AD DS      │    │ - AppLocker  │         │
│  │ - DNS        │    │ - WinRM      │         │
│  │ - Kerberos   │    │ - Test Apps  │         │
│  └──────────────┘    └──────────────┘         │
│         ▲                    ▲                 │
│         │                    │                 │
│         └────────┬───────────┘                 │
│                  │                             │
│         ┌────────┴──────────┐                 │
│         │ Application        │                 │
│         │ Container (APP01) │                 │
│         │                   │                 │
│         │ - Node.js         │                 │
│         │ - Electron        │                 │
│         │ - App Source      │                 │
│         └───────────────────┘                 │
└─────────────────────────────────────────────────┘
```

## Container Details

### Domain Controller

**Image:** Ubuntu 22.04 with Samba AD (Linux) or Windows Server Core (Windows)

**Services:**
- Active Directory Domain Services
- DNS Server
- Kerberos Authentication
- LDAP/LDAPS

**Ports:**
- 53 (DNS)
- 88 (Kerberos)
- 389 (LDAP)
- 445 (SMB)
- 636 (LDAPS)
- 3268/3269 (Global Catalog)

**Default Configuration:**
- Domain: `applocker.local`
- NetBIOS: `APPLOCKER`
- Admin: `Administrator` / `SecurePass123!`

**Test Users:**
- `testuser1` / `TestUser1@123`
- `testuser2` / `TestUser2@123`

**Test Groups:**
- `AppLocker-Users`
- `AppLocker-Admins`

### Windows Client

**Image:** Ubuntu 22.04 (Linux) or Windows 10/11 Enterprise (Windows)

**Services:**
- WinRM (HTTP/HTTPS)
- Domain-joined client
- Test applications

**Ports:**
- 5985 (WinRM HTTP)
- 5986 (WinRM HTTPS)
- 3389 (RDP - Windows only)

**Features:**
- AppLocker enabled (Windows containers only)
- Remote scanning capability
- Test application directory

### Application Container

**Image:** Node.js 20 (Linux) or Windows Server Core with Node.js (Windows)

**Services:**
- Node.js development environment
- Application source code
- Build tools

**Ports:**
- 3000 (Vite dev server)
- 5173 (Alternative Vite port)

## Usage

### Starting the Environment

1. **Navigate to docker directory:**
   ```bash
   cd docker
   ```

2. **Start containers:**
   ```bash
   docker compose up -d
   ```

3. **Wait for initialization:**
   ```bash
   docker compose logs -f
   ```

4. **Verify services:**
   ```bash
   docker compose ps
   ```

### Accessing Containers

**Domain Controller:**
```bash
docker exec -it ga-applocker-dc /bin/bash
```

**Windows Client:**
```bash
docker exec -it ga-applocker-client /bin/bash
```

**Application Container:**
```bash
# Linux
docker exec -it ga-applocker-app /bin/bash

# Windows
docker exec -it ga-applocker-app powershell
```

### Running the Application

1. **Enter application container:**
   ```bash
   docker exec -it ga-applocker-app powershell
   ```

2. **Install dependencies (first time):**
   ```powershell
   npm install
   ```

3. **Start development server:**
   ```powershell
   npm run dev
   ```

4. **In another terminal, start Electron:**
   ```powershell
   docker exec -it ga-applocker-app powershell
   npm run electron:dev
   ```

### Testing AD Integration

**Test LDAP Connection:**
```bash
docker exec -it ga-applocker-dc ldapsearch -x -H ldap://localhost -b "dc=applocker,dc=local"
```

**Test Domain Join (Windows):**
```powershell
docker exec -it ga-applocker-client-win powershell
kinit Administrator
```

**List Domain Users:**
```bash
docker exec -it ga-applocker-dc samba-tool user list
```

### Testing WinRM (Remote Scanning)

**From Windows Host:**
```powershell
$cred = Get-Credential
Invoke-Command -ComputerName localhost -Port 5985 -Credential $cred -ScriptBlock { Get-Process }
```

**From Application:**
- Use the Remote Scan module in the application
- Configure WinRM endpoint: `localhost:5985`
- Use credentials: `Administrator` / `SecurePass123!`

### Testing AppLocker (Windows Containers Only)

**Check AppLocker Status:**
```powershell
docker exec -it ga-applocker-client-win powershell
Get-AppLockerPolicy -Effective
```

**Create Test Policy:**
```powershell
docker exec -it ga-applocker-client-win powershell
New-AppLockerPolicy -RuleType Path -User Everyone -Path "C:\TestApps\*" -Action Allow
```

## Configuration

### Environment Variables

Create a `.env` file in the `docker` directory:

```env
DOMAIN_NAME=applocker.local
DOMAIN_NETBIOS=APPLOCKER
DOMAIN_ADMIN_PASSWORD=SecurePass123!
DNS_FORWARDER=8.8.8.8
```

### Network Configuration

Default subnet: `172.20.0.0/16`

To change, edit `docker-compose.yml`:
```yaml
networks:
  applocker-network:
    ipam:
      config:
        - subnet: 172.21.0.0/16  # Change this
```

### Port Mapping

To change exposed ports, edit `docker-compose.yml`:
```yaml
ports:
  - "3000:3000"  # Change host port (left side)
```

## Troubleshooting

### Domain Controller Not Starting

**Check logs:**
```bash
docker compose logs domain-controller
```

**Common issues:**
- Port conflicts (53, 88, 389, 445)
- Insufficient resources
- DNS resolution problems

**Solutions:**
```bash
# Restart container
docker compose restart domain-controller

# Check port availability
netstat -an | findstr "53 88 389"

# Increase resources in Docker Desktop settings
```

### Client Cannot Join Domain

**Verify DNS:**
```bash
docker exec -it ga-applocker-client nslookup domain-controller
```

**Check Kerberos:**
```bash
docker exec -it ga-applocker-client kinit Administrator
```

**Solutions:**
- Wait longer for DC to be ready (30-60 seconds)
- Check DNS configuration
- Verify network connectivity

### Application Build Errors

**Clear cache:**
```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

**Reinstall dependencies:**
```bash
docker exec -it ga-applocker-app powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### Windows Container Issues

**Enable Windows Containers:**
1. Right-click Docker Desktop icon
2. Select "Switch to Windows containers"

**Enable Hyper-V (Windows 10/11):**
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```

**Check Windows container support:**
```powershell
docker version
# Should show "OS/Arch: windows/amd64" for Server
```

## Maintenance

### Updating Containers

```bash
docker compose pull
docker compose up -d --build
```

### Resetting Environment

```bash
# Stop and remove everything
docker compose down -v

# Remove images (optional)
docker rmi ga-applocker-dc ga-applocker-client ga-applocker-app

# Start fresh
docker compose up -d --build
```

### Backup Data

```bash
# Backup volumes
docker run --rm -v ga-applocker-dc-data:/data -v $(pwd):/backup ubuntu tar czf /backup/dc-backup.tar.gz /data
```

### Viewing Logs

```bash
# All containers
docker compose logs -f

# Specific container
docker compose logs -f domain-controller

# Last 100 lines
docker compose logs --tail=100 domain-controller
```

## Security Notes

⚠️ **This is a lab environment only!**

- Default passwords are weak
- Do not expose to internet
- Use only in isolated networks
- Reset volumes when done
- Change default credentials for production-like testing

## Next Steps

1. **Test AD Integration**
   - Connect application to domain
   - Test user/group management
   - Verify LDAP queries

2. **Test AppLocker**
   - Deploy test policies
   - Generate rules
   - Monitor events

3. **Test Remote Scanning**
   - Configure WinRM
   - Scan client machines
   - Collect inventory

4. **Test Compliance**
   - Generate reports
   - Export evidence packages
   - Validate policies

## Support

For issues:
- Check logs: `docker compose logs`
- Review README.md
- Check Docker documentation

## License

Same as main project - GA-ASI Internal Use
