/**
 * App Lifecycle Handlers
 * Handles Electron app lifecycle events
 */

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

/**
 * Check if running in development mode
 * @returns {boolean} - True if in development mode
 */
function isDevelopment() {
  if (!app) {
    return process.env.NODE_ENV === 'development';
  }
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
}

/**
 * Get content URL or path based on environment
 * @returns {{url: string, isDev: boolean}} - Content URL/path and dev flag
 */
function getContentPath() {
  const isDev = isDevelopment();
  const devServerUrl = process.env.DEV_SERVER_URL || 'http://localhost:3000';

  if (isDev) {
    return {
      url: devServerUrl,
      isDev: true,
    };
  } else {
    // In production, use relative path from electron directory
    // When packaged, dist folder is in the same directory as electron files
    return {
      url: path.join(__dirname, '..', 'dist', 'index.html'),
      isDev: false,
    };
  }
}

/**
 * Setup application lifecycle handlers
 * @param {object} windowManager - Window manager instance
 * @param {function} loadContent - Function to load content
 */
function setupAppLifecycle(windowManager, loadContent) {
  if (!app || !app.whenReady) {
    console.error('Electron app not available in setupAppLifecycle');
    return;
  }
  
  let isInitializing = false;
  
  // App is ready
  app.whenReady()
    .then(() => {
      isInitializing = true;
      try {
        loadContent();
      } catch (error) {
        console.error('Failed to load content on app ready:', error);
      }
      isInitializing = false;

      app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        // Prevent race condition by checking initialization state
        if (BrowserWindow.getAllWindows().length === 0 && !isInitializing) {
          try {
            loadContent();
          } catch (error) {
            console.error('Failed to load content on activate:', error);
          }
        }
      });
    })
    .catch((error) => {
      console.error('[AppLifecycle] App failed to initialize:', error);
      
      // Show error dialog before quitting
      if (dialog) {
        dialog.showErrorBox(
          'Application Error',
          `Failed to start the application:\n\n${error.message}\n\nThe application will now exit.`
        );
      }
      
      app.quit();
    });

  // Quit when all windows are closed (except on macOS)
  if (app && app.on) {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle app termination
    app.on('before-quit', (event) => {
      // Add any cleanup logic here
      if (process.env.NODE_ENV === 'development') {
        console.log('Application shutting down...');
      }
    });
  }
}

module.exports = {
  setupAppLifecycle,
  isDevelopment,
  getContentPath,
};
