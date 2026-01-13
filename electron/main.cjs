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

// Global shutdown flag to prevent operations during exit
// Use global to share across modules
global.isShuttingDown = false;

// Set shutdown flag when app is quitting
if (app && app.on) {
  app.on('before-quit', () => {
    global.isShuttingDown = true;
  });
  app.on('will-quit', () => {
    global.isShuttingDown = true;
  });
}

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
    
    // Show user-friendly error dialog (only if app is still available and not shutting down)
    if (app && !global.isShuttingDown && dialog) {
      try {
        dialog.showErrorBox(
          'Application Initialization Error',
          `Failed to start the application:\n\n${error.message}\n\nPlease contact support if this problem persists.`
        );
      } catch (e) {
        console.error('Could not show error dialog:', e.message);
      }
      if (app && !global.isShuttingDown) {
        app.quit();
      }
    }
  }
}

// Setup app lifecycle handlers
setupAppLifecycle(windowManager, initializeApp);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error);
  console.error('[Main] Stack:', error.stack);
  
  // Don't show dialogs during shutdown
  if (global.isShuttingDown) {
    return;
  }
  
  // Show error dialog to user (only if window still exists and not shutting down)
  const mainWindow = windowManager.getMainWindow();
  if (app && !global.isShuttingDown && dialog) {
    try {
      // Only show dialog if window exists and is not destroyed
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          'Application Error',
          `An unexpected error occurred:\n\n${error.message}\n\nThe application will now exit.\n\nPlease report this error to support.`
        );
      }
    } catch (e) {
      // Window may have been destroyed, just log
      console.error('Could not show error dialog:', e.message);
    }
  }
  
  // In production, might want to log to file or send to error tracking service
  if (app && !global.isShuttingDown) {
    global.isShuttingDown = true;
    app.quit();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  // Don't process rejections during shutdown
  if (global.isShuttingDown) {
    return;
  }
  
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[Main] Unhandled Rejection at:', promise);
  console.error('[Main] Reason:', error.message);
  console.error('[Main] Stack:', error.stack);
  
  // Show error dialog for critical unhandled rejections (only if window exists and not shutting down)
  const mainWindow = windowManager.getMainWindow();
  if (app && !global.isShuttingDown && dialog && process.env.NODE_ENV === 'production') {
    try {
      // Only show dialog if window exists and is not destroyed
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          'Application Error',
          `An unexpected error occurred:\n\n${error.message}\n\nPlease report this error to support.`
        );
      }
    } catch (e) {
      // Window may have been destroyed, just log
      console.error('Could not show error dialog:', e.message);
    }
  }
  
  // In production, might want to log to file or send to error tracking service
});
