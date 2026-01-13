/**
 * Window Manager
 * Handles BrowserWindow creation and lifecycle
 */

const { BrowserWindow, dialog } = require('electron');
const path = require('path');

// Constants for window configuration
const WINDOW_CONSTANTS = {
  MIN_WIDTH: 100,
  MAX_WIDTH: 10000,
  MIN_HEIGHT: 100,
  MAX_HEIGHT: 10000,
  DEFAULT_WIDTH: 1400,
  DEFAULT_HEIGHT: 900,
  DEFAULT_MIN_WIDTH: 1200,
  DEFAULT_MIN_HEIGHT: 700,
  DEFAULT_BACKGROUND_COLOR: '#f1f5f9',
  LOAD_TIMEOUT: 30000, // 30 seconds
};

/**
 * Validate and sanitize window configuration
 * @param {object} config - Window configuration object
 * @returns {object} - Validated and sanitized configuration
 */
function validateWindowConfig(config = {}) {
  return {
    width: Math.max(
      WINDOW_CONSTANTS.MIN_WIDTH,
      Math.min(WINDOW_CONSTANTS.MAX_WIDTH, config.width || WINDOW_CONSTANTS.DEFAULT_WIDTH)
    ),
    height: Math.max(
      WINDOW_CONSTANTS.MIN_HEIGHT,
      Math.min(WINDOW_CONSTANTS.MAX_HEIGHT, config.height || WINDOW_CONSTANTS.DEFAULT_HEIGHT)
    ),
    minWidth: Math.max(WINDOW_CONSTANTS.MIN_WIDTH, config.minWidth || WINDOW_CONSTANTS.DEFAULT_MIN_WIDTH),
    minHeight: Math.max(WINDOW_CONSTANTS.MIN_HEIGHT, config.minHeight || WINDOW_CONSTANTS.DEFAULT_MIN_HEIGHT),
    backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(config.backgroundColor)
      ? config.backgroundColor
      : WINDOW_CONSTANTS.DEFAULT_BACKGROUND_COLOR,
    show: typeof config.show === 'boolean' ? config.show : false,
  };
}

class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  /**
   * Create the main application window
   * @param {object} config - Window configuration options
   * @returns {BrowserWindow} - Created browser window
   * @throws {Error} - If window creation fails
   */
  createMainWindow(config = {}) {
    try {
      const validatedConfig = validateWindowConfig(config);
      
      const windowOptions = {
        width: validatedConfig.width,
        height: validatedConfig.height,
        minWidth: validatedConfig.minWidth,
        minHeight: validatedConfig.minHeight,
        backgroundColor: validatedConfig.backgroundColor,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: path.join(__dirname, 'preload.cjs'),
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false,
        },
        titleBarStyle: 'default',
        show: validatedConfig.show,
      };

      this.mainWindow = new BrowserWindow(windowOptions);
      this.setupWindowHandlers();

      return this.mainWindow;
    } catch (error) {
      console.error('[WindowManager] Failed to create window:', error);
      
      // Show error dialog to user
      if (dialog) {
        dialog.showErrorBox(
          'Window Creation Error',
          `Failed to create application window:\n\n${error.message}\n\nPlease try restarting the application.`
        );
      }
      
      throw error;
    }
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
      // Clean up event listeners to prevent memory leaks
      if (this.mainWindow) {
        this.mainWindow.webContents.removeAllListeners('did-fail-load');
      }
      this.mainWindow = null;
    });
  }

  /**
   * Load content into the window with error handling and timeout
   * @param {string} urlOrPath - URL or file path to load
   * @param {boolean} isDev - Whether running in development mode
   * @param {boolean} enableDevToolsInProduction - Whether to enable DevTools (should be false in production)
   * @returns {Promise<void>}
   */
  async loadContent(urlOrPath, isDev, enableDevToolsInProduction = false) {
    if (!this.mainWindow) {
      console.error('Cannot load content: window not initialized');
      return;
    }

    // Validate input
    if (typeof urlOrPath !== 'string' || urlOrPath.trim() === '') {
      console.error('Invalid urlOrPath provided to loadContent');
      return;
    }

    // Remove old listeners before adding new ones to prevent memory leaks
    this.mainWindow.webContents.removeAllListeners('did-fail-load');
    
    // Add error handler
    this.mainWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', validatedURL);
      console.error('Error code:', errorCode);
      console.error('Error description:', errorDescription);
      // In production, consider showing user-friendly error dialog
      if (!isDev && this.mainWindow) {
        this.mainWindow.webContents.send('load-error', {
          code: errorCode,
          description: errorDescription,
        });
      }
    });

    try {
      if (isDev) {
        await this.mainWindow.loadURL(urlOrPath);
        this.mainWindow.webContents.openDevTools();
      } else {
        // Add timeout to prevent hanging
        const loadPromise = this.mainWindow.loadFile(urlOrPath);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Load timeout')), WINDOW_CONSTANTS.LOAD_TIMEOUT)
        );
        
        await Promise.race([loadPromise, timeoutPromise]);
        
        // SECURITY: Only enable DevTools if explicitly configured (should be false in production)
        if (enableDevToolsInProduction) {
          console.warn('WARNING: DevTools enabled in production - this is a security risk!');
          this.mainWindow.webContents.openDevTools();
        }
      }
    } catch (error) {
      console.error('[WindowManager] Failed to load content:', error);
      
      // Show error dialog to user
      if (dialog && this.mainWindow && !this.mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          'Content Load Error',
          `Failed to load application content:\n\n${error.message}\n\nPath: ${urlOrPath}\n\nPlease verify the application files are intact.`
        );
      }
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('load-error', {
          code: 'LOAD_FAILED',
          description: error.message,
        });
      }
    }
  }

  /**
   * Get the main window instance
   * @returns {BrowserWindow|null} - Main window instance or null
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * Toggle DevTools (for debugging purposes)
   */
  toggleDevTools() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.toggleDevTools();
    }
  }
}

module.exports = { WindowManager };
