# 🐳 Docker Desktop Installation Guide

## Quick Install (If Chocolatey is Available)

If you have Chocolatey installed:

```powershell
# Run as Administrator
.\auto-install-docker.ps1
```

This will automatically install Docker Desktop.

## Manual Installation

### Step 1: Download
1. Go to: https://www.docker.com/products/docker-desktop
2. Click "Download for Windows"
3. Save the installer (Docker Desktop Installer.exe)

### Step 2: Install
1. Run `Docker Desktop Installer.exe`
2. Follow the installation wizard:
   - Accept the license agreement
   - Choose installation location (default is fine)
   - Ensure "Use WSL 2 instead of Hyper-V" is checked (recommended)
   - Click "Install"
3. Wait for installation to complete

### Step 3: Start Docker Desktop
1. Find "Docker Desktop" in Start Menu
2. Launch it
3. Wait for Docker to fully start (check system tray for whale icon)
4. The icon should be steady (not animating) when ready

### Step 4: Verify
```powershell
cd docker
.\validate-setup.ps1
```

Or run the test suite:
```powershell
.\run-tests-enhanced.ps1
```

## Install Chocolatey First (Optional)

If you want to use automated installation but don't have Chocolatey:

1. Open PowerShell as Administrator
2. Run:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

3. Then run: `.\auto-install-docker.ps1`

## System Requirements

- Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
- Windows 11 64-bit: Home or Pro version 21H2 or higher
- WSL 2 feature enabled
- Virtualization enabled in BIOS
- At least 4GB RAM (8GB+ recommended)

## After Installation

Once Docker Desktop is installed and running:

```powershell
cd docker
.\run-tests-enhanced.ps1
```

This will:
- Verify Docker is working
- Start all containers
- Run comprehensive tests
- Show you how to access the application

---

**Need help?** Run `.\install-docker.ps1` for interactive guidance.
