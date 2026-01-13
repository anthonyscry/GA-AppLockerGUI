/**
 * Startup Verification Script
 * Verifies all critical components are ready
 */

const fs = require('fs');
const path = require('path');

const checks = [];
let allPassed = true;

function check(name, condition, errorMsg) {
  const passed = condition();
  checks.push({ name, passed, errorMsg: passed ? null : errorMsg });
  if (!passed) {
    allPassed = false;
    console.error(`❌ ${name}: ${errorMsg}`);
  } else {
    console.log(`✅ ${name}`);
  }
}

console.log('🔍 Verifying GA-AppLocker Dashboard startup requirements...\n');

// Check critical files exist
check('Main entry point exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'electron', 'main.cjs'));
}, 'electron/main.cjs not found');

check('Package.json exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'package.json'));
}, 'package.json not found');

check('Vite config exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'vite.config.ts'));
}, 'vite.config.ts not found');

check('Preload script exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'electron', 'preload.cjs'));
}, 'electron/preload.cjs not found');

check('Window manager exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'electron', 'windowManager.cjs'));
}, 'electron/windowManager.cjs not found');

check('Security handlers exist', () => {
  return fs.existsSync(path.join(__dirname, '..', 'electron', 'security.cjs'));
}, 'electron/security.cjs not found');

check('App lifecycle exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'electron', 'appLifecycle.cjs'));
}, 'electron/appLifecycle.cjs not found');

check('IPC handlers exist', () => {
  return fs.existsSync(path.join(__dirname, '..', 'electron', 'ipc', 'ipcHandlers.cjs'));
}, 'electron/ipc/ipcHandlers.cjs not found');

check('App config exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'config', 'appConfig.cjs'));
}, 'config/appConfig.cjs not found');

// Check build output
check('Build directory exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'dist'));
}, 'dist directory not found - run "npm run build" first');

check('Build index.html exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'dist', 'index.html'));
}, 'dist/index.html not found - run "npm run build" first');

// Check node_modules
check('Node modules installed', () => {
  return fs.existsSync(path.join(__dirname, '..', 'node_modules'));
}, 'node_modules not found - run "npm install" first');

// Check package.json main entry
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  check('Package.json main entry correct', () => {
    return packageJson.main === 'electron/main.cjs';
  }, `package.json main should be "electron/main.cjs", got "${packageJson.main}"`);
} catch (e) {
  check('Package.json readable', () => false, `Cannot read package.json: ${e.message}`);
}

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All checks passed! App is ready to run.');
  console.log('\nTo start the app:');
  console.log('  1. Terminal 1: npm run dev');
  console.log('  2. Terminal 2: npm run electron:dev');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
  process.exit(1);
}
