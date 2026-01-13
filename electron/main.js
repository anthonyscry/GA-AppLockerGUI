const { app } = require('electron');
const { WindowManager } = require('./windowManager.js');
const { setupSecurityHandlers, setupCertificateValidation } = require('./security.js');
const { setupAppLifecycle, getContentPath } = require('./appLifecycle.js');
const { AppConfig } = require('../config/appConfig.js');

// Initialize security handlers
setupSecurityHandlers();
setupCertificateValidation();

// Initialize window manager
const windowManager = new WindowManager();

/**
 * Create and load the main window
 */
function initializeApp() {
  const window = windowManager.createMainWindow({
    width: AppConfig.window.defaultWidth,
    height: AppConfig.window.defaultHeight,
    minWidth: AppConfig.window.minWidth,
    minHeight: AppConfig.window.minHeight,
    backgroundColor: AppConfig.window.backgroundColor,
    show: false,
  });

  const { url, isDev } = getContentPath();
  windowManager.loadContent(url, isDev, AppConfig.dev.devToolsInProduction);
}

// Setup app lifecycle handlers
setupAppLifecycle(windowManager, initializeApp);