const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');

(async () => {
  console.log('Starting Electron app to take screenshot...');
  
  // Wait a bit for dev server to be ready
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Use Electron's built-in screenshot capability via a test script
  // Or we can use the built dist folder
  console.log('Note: To capture Electron window screenshot, you may need to:');
  console.log('1. Run: npm run electron:dev');
  console.log('2. Use Windows Snipping Tool or Print Screen');
  console.log('3. Or check the dist folder for the built app');
  
  console.log('\nThe correct AppLocker app should show:');
  console.log('- Sidebar: "GA-ASI AppLocker Toolkit"');
  console.log('- Navigation: Dashboard, Remote Scan, Policy Lab, Events, AD Manager, Compliance');
  console.log('- Title: "GA-AppLocker Dashboard"');
})();
