const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Wait for dev server to be ready
  console.log('Waiting for dev server at http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait a bit for React to render
  await page.waitForTimeout(2000);
  
  // Take screenshot
  const screenshotPath = 'ui-screenshot.png';
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: true,
    type: 'png'
  });
  
  console.log(`Screenshot saved to: ${screenshotPath}`);
  
  await browser.close();
})();
