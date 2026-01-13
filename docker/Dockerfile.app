# Development container for GA-AppLocker Dashboard
# This container provides the Node.js environment for building and testing the app

FROM node:20-windowsservercore

LABEL maintainer="GA-ASI ISSO Team"
LABEL description="Development environment for GA-AppLocker Dashboard"

# Set working directory
WORKDIR /app

# Install Windows build tools and PowerShell
RUN powershell -Command \
    Set-ExecutionPolicy Bypass -Scope Process -Force; \
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; \
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')); \
    choco install -y nodejs-lts python3 git

# Install PowerShell 7
RUN powershell -Command \
    Invoke-WebRequest -Uri https://aka.ms/install-powershell.ps1 -OutFile install-ps7.ps1; \
    .\install-ps7.ps1 -UseMSI -Quiet

# Install AppLocker PowerShell module (requires Windows Enterprise/Server)
RUN powershell -Command \
    Install-WindowsFeature -Name AppLocker -IncludeManagementTools; \
    Import-Module AppLocker -ErrorAction SilentlyContinue

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Expose development ports
EXPOSE 3000 5173

# Default command (can be overridden in docker-compose)
CMD ["powershell", "-Command", "npm run dev"]
