/**
 * Window Manager
 * Handles BrowserWindow creation and lifecycle
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  /**
   * Create the main application window
   */
  createMainWindow(config = {}) {
    const windowOptions = {
      width: config.width || 1400,
      height: config.height || 900,
      minWidth: config.minWidth || 1200,
      minHeight: config.minHeight || 700,
      backgroundColor: config.backgroundColor || '#f1f5f9',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: 'default',
      show: config.show !== undefined ? config.show : false,
    };

    this.mainWindow = new BrowserWindow(windowOptions);
    this.setupWindowHandlers();

    return this.mainWindow;
  }

  /**
   * Setup window event handlers
   */
  setupWindowHandlers() {
    if (!this.mainWindow) return;

    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        if (process.env.NODE_ENV === 'development') {
          this.mainWindow.focus();
        }
      }
    });

    this.mainWindow.on('closed', () => {
      // Dereference the window object
      this.mainWindow = null;
    });
  }

  /**
   * Load content into the window
   */
  loadContent(urlOrPath, isDev, enableDevToolsInProduction = false) {
    if (!this.mainWindow) return;

    // Add error handlers for debugging
    this.mainWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', validatedURL);
      console.error('Error code:', errorCode);
      console.error('Error description:', errorDescription);
    });

    if (isDev) {
      this.mainWindow.loadURL(urlOrPath);
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(urlOrPath);
      if (enableDevToolsInProduction) {
        this.mainWindow.webContents.openDevTools();
      }
    }
  }

  /**
   * Get the main window instance
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * Show DevTools
   */
  toggleDevTools() {
    if (this.mainWindow) {
      this.mainWindow.webContents.toggleDevTools();
    }
  }
}

module.exports = { WindowManager };
