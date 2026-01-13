/**
 * App Lifecycle Handlers
 * Handles Electron app lifecycle events
 */

const { app, BrowserWindow } = require('electron');

/**
 * Setup application lifecycle handlers
 */
function setupAppLifecycle(windowManager, loadContent) {
  // App is ready
  app.whenReady().then(() => {
    loadContent();

    app.on('activate', () => {
      // On macOS, re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        loadContent();
      }
    });
  });

  // Quit when all windows are closed (except on macOS)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Handle app termination
  app.on('before-quit', (event) => {
    // Add any cleanup logic here
    console.log('Application shutting down...');
  });
}

/**
 * Check if running in development mode
 */
function isDevelopment() {
  if (!app || !app.isPackaged) {
    return process.env.NODE_ENV === 'development';
  }
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
}

/**
 * Get content URL or path based on environment
 */
function getContentPath() {
  const path = require('path');
  const isDev = isDevelopment();

  if (isDev) {
    return {
      url: 'http://localhost:3000',
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

module.exports = {
  setupAppLifecycle,
  isDevelopment,
  getContentPath,
};
