#!/bin/bash
# Linux container test script for GA-AppLocker Dashboard
# Alternative to test-app.ps1 for Linux containers

set -e

echo "=== GA-AppLocker Dashboard - Docker Test Suite (Linux) ==="
echo ""

# Test 1: Node.js
echo "[TEST 1] Node.js Version"
if command -v node &> /dev/null; then
    node --version
    echo "✅ Node.js OK"
else
    echo "❌ Node.js not found"
    exit 1
fi
echo ""

# Test 2: npm
echo "[TEST 2] npm Version"
if command -v npm &> /dev/null; then
    npm --version
    echo "✅ npm OK"
else
    echo "❌ npm not found"
    exit 1
fi
echo ""

# Test 3: Dependencies
echo "[TEST 3] Dependencies"
cd /app
if [ -d "node_modules" ]; then
    echo "✅ node_modules exists"
else
    echo "⚠️  node_modules not found, running npm install..."
    npm install
fi
echo ""

# Test 4: Build React app
echo "[TEST 4] Building React App"
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi
echo ""

# Test 5: Check PowerShell scripts
echo "[TEST 5] PowerShell Scripts"
if [ -d "/app/scripts" ]; then
    script_count=$(find /app/scripts -name "*.ps1" | wc -l)
    echo "✅ Found $script_count PowerShell scripts"
else
    echo "⚠️  Scripts directory not found"
fi
echo ""

# Test 6: TypeScript compilation
echo "[TEST 6] TypeScript Compilation"
if command -v npx &> /dev/null; then
    npx tsc --noEmit
    if [ $? -eq 0 ]; then
        echo "✅ TypeScript compiles successfully"
    else
        echo "❌ TypeScript errors found"
        exit 1
    fi
else
    echo "⚠️  npx not available, skipping TypeScript check"
fi
echo ""

# Test 7: Check dist folder
echo "[TEST 7] Build Output"
if [ -f "dist/index.html" ]; then
    echo "✅ dist/index.html exists"
else
    echo "⚠️  dist/index.html not found (may be in different location)"
    if [ -d "dist" ]; then
        echo "   dist folder exists with:"
        ls -la dist | head -5
    fi
fi
echo ""

echo "=== All Tests Passed! ==="
echo ""
echo "Next steps:"
echo "  1. Start dev server: npm run dev"
echo "  2. Access app at: http://localhost:3000"
echo ""
