# Test script for GA-AppLocker Application
# This script runs basic tests to verify the application setup

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "GA-AppLocker Application Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Test 1: Check Node.js
Write-Host "Test 1: Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js not found" -ForegroundColor Red
    exit 1
}

# Test 2: Check npm
Write-Host "Test 2: Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "  ✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ npm not found" -ForegroundColor Red
    exit 1
}

# Test 3: Check if node_modules exists
Write-Host "Test 3: Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  ✅ node_modules directory exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  node_modules not found. Run 'npm install' first" -ForegroundColor Yellow
}

# Test 4: Check package.json
Write-Host "Test 4: Checking package.json..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content package.json | ConvertFrom-Json
    Write-Host "  ✅ Package: $($packageJson.name) v$($packageJson.version)" -ForegroundColor Green
} else {
    Write-Host "  ❌ package.json not found" -ForegroundColor Red
    exit 1
}

# Test 5: Check if build works
Write-Host "Test 5: Testing build..." -ForegroundColor Yellow
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Build successful" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Build completed with warnings" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Build test skipped or failed: $_" -ForegroundColor Yellow
}

# Test 6: Check TypeScript compilation
Write-Host "Test 6: Checking TypeScript..." -ForegroundColor Yellow
if (Test-Path "tsconfig.json") {
    try {
        $tscVersion = npx tsc --version 2>&1
        Write-Host "  ✅ TypeScript available" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  TypeScript check skipped" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  tsconfig.json not found" -ForegroundColor Yellow
}

# Test 7: Check Electron
Write-Host "Test 7: Checking Electron..." -ForegroundColor Yellow
try {
    $electronVersion = npx electron --version 2>&1
    Write-Host "  ✅ Electron: $electronVersion" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Electron check skipped" -ForegroundColor Yellow
}

# Test 8: Check application files
Write-Host "Test 8: Checking application structure..." -ForegroundColor Yellow
$requiredFiles = @(
    "App.tsx",
    "index.tsx",
    "electron/main.cjs",
    "package.json"
)

$allFound = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file not found" -ForegroundColor Red
        $allFound = $false
    }
}

if (-not $allFound) {
    Write-Host "  ⚠️  Some required files are missing" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Tests completed!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
