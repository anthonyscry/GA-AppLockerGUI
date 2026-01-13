/**
 * Dialog Handlers
 * File dialog handlers for Electron IPC
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';

export function setupDialogHandlers(): void {
  if (!ipcMain) {
    console.warn('[Dialog] ipcMain not available, skipping dialog handler setup');
    return;
  }

  /**
   * Show open file dialog
   */
  ipcMain.handle('dialog:showOpenDialog', async (event, options = {}) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(window || undefined, {
        title: options.title || 'Select File',
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: options.properties || ['openFile'],
        ...options
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
        filePath: result.filePaths[0] || null
      };
    } catch (error: any) {
      console.error('[Dialog] Open dialog error:', error);
      return {
        canceled: true,
        filePaths: [],
        filePath: null,
        error: error.message
      };
    }
  });

  /**
   * Show save file dialog
   */
  ipcMain.handle('dialog:showSaveDialog', async (event, options = {}) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(window || undefined, {
        title: options.title || 'Save File',
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'All Files', extensions: ['*'] }
        ],
        ...options
      });

      return {
        canceled: result.canceled,
        filePath: result.filePath || null
      };
    } catch (error: any) {
      console.error('[Dialog] Save dialog error:', error);
      return {
        canceled: true,
        filePath: null,
        error: error.message
      };
    }
  });

  /**
   * Show open directory dialog
   */
  ipcMain.handle('dialog:showOpenDirectoryDialog', async (event, options = {}) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(window || undefined, {
        title: options.title || 'Select Directory',
        defaultPath: options.defaultPath,
        properties: ['openDirectory', 'createDirectory'],
        ...options
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
        filePath: result.filePaths[0] || null
      };
    } catch (error: any) {
      console.error('[Dialog] Open directory dialog error:', error);
      return {
        canceled: true,
        filePaths: [],
        filePath: null,
        error: error.message
      };
    }
  });

  console.log('[Dialog] Dialog handlers registered successfully');
}
