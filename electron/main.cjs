/**
 * Main Electron Process
 * Entry point for the Electron application
 */

const { app, dialog } = require('electron');
const { WindowManager } = require('./windowManager.cjs');
const { setupSecurityHandlers, setupCertificateValidation } = require('./security.cjs');
const { setupAppLifecycle, getContentPath } = require('./appLifecycle.cjs');
const { AppConfig } = require('../config/appConfig.cjs');
const { setupIpcHandlers } = require('./ipc/ipcHandlers.cjs');

/**
 * Initialize security handlers
 * Must be called before app is ready
 */
try {
  setupSecurityHandlers();
  setupCertificateValidation();
} catch (error) {
  console.error('Failed to setup security handlers:', error);
  // Continue anyway - better than crashing silently
}

// Initialize window manager
const windowManager = new WindowManager();

// Setup IPC handlers for PowerShell script execution
try {
  setupIpcHandlers();
} catch (error) {
  console.error('Failed to setup IPC handlers:', error);
  // Continue anyway - handlers may not be needed in all environments
}

/**
 * Create and load the main window
 * @throws {Error} - If initialization fails
 */
async function initializeApp() {
  try {
    const window = windowManager.createMainWindow({
      width: AppConfig.window.defaultWidth,
      height: AppConfig.window.defaultHeight,
      minWidth: AppConfig.window.minWidth,
      minHeight: AppConfig.window.minHeight,
      backgroundColor: AppConfig.window.backgroundColor,
      show: false,
    });

    const { url, isDev } = getContentPath();
    
    // SECURITY: Warn if DevTools are enabled in production
    if (!isDev && AppConfig.dev.devToolsInProduction) {
      const response = await dialog.showMessageBox({
        type: 'warning',
        title: 'Security Warning',
        message: 'DevTools are enabled in production',
        detail: 'This is a security risk. DevTools should be disabled in production builds.',
        buttons: ['Continue Anyway', 'Exit Application'],
        defaultId: 1,
      });
      
      if (response.response === 1) {
        app.quit();
        return;
      }
    }
    
    await windowManager.loadContent(url, isDev, AppConfig.dev.devToolsInProduction);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    
    // Show user-friendly error dialog
    if (app && !app.isQuiting) {
      dialog.showErrorBox(
        'Application Initialization Error',
        `Failed to start the application:\n\n${error.message}\n\nPlease contact support if this problem persists.`
      );
      app.quit();
    }
  }
}

// Setup app lifecycle handlers
setupAppLifecycle(windowManager, initializeApp);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error);
  console.error('[Main] Stack:', error.stack);
  
  // Show error dialog to user
  if (app && !app.isQuiting && dialog) {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred:\n\n${error.message}\n\nThe application will now exit.\n\nPlease report this error to support.`
    );
  }
  
  // In production, might want to log to file or send to error tracking service
  if (app && !app.isQuiting) {
    app.quit();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[Main] Unhandled Rejection at:', promise);
  console.error('[Main] Reason:', error.message);
  console.error('[Main] Stack:', error.stack);
  
  // Show error dialog for critical unhandled rejections
  if (app && !app.isQuiting && dialog && process.env.NODE_ENV === 'production') {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred:\n\n${error.message}\n\nPlease report this error to support.`
    );
  }
  
  // In production, might want to log to file or send to error tracking service
});
