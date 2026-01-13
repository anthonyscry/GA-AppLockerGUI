/**
 * File Dialog Utilities
 * Helper functions for showing file dialogs via IPC
 */

import { ipcClient } from './ipcClient';
import { IPCChannels } from './channels';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections')[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
}

/**
 * Show open file dialog
 */
export async function showOpenDialog(options: OpenDialogOptions = {}): Promise<string | null> {
  try {
    if (!ipcClient.isAvailable()) {
      // Fallback to browser file input
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        if (options.filters && options.filters.length > 0) {
          const accept = options.filters
            .map(f => f.extensions.map(ext => `.${ext}`).join(','))
            .join(',');
          input.accept = accept;
        }
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          resolve(file ? file.path || file.name : null);
        };
        input.oncancel = () => resolve(null);
        input.click();
      });
    }

    const result = await ipcClient.invoke<{
      canceled: boolean;
      filePaths: string[];
      filePath: string | null;
    }>(IPCChannels.DIALOG.SHOW_OPEN_DIALOG, options);

    return result.canceled ? null : (result.filePath || null);
  } catch (error) {
    console.error('Failed to show open dialog:', error);
    return null;
  }
}

/**
 * Show save file dialog
 */
export async function showSaveDialog(options: SaveDialogOptions = {}): Promise<string | null> {
  try {
    if (!ipcClient.isAvailable()) {
      // Fallback to browser download
      const defaultName = options.defaultPath?.split(/[/\\]/).pop() || 'download';
      return defaultName;
    }

    const result = await ipcClient.invoke<{
      canceled: boolean;
      filePath: string | null;
    }>(IPCChannels.DIALOG.SHOW_SAVE_DIALOG, options);

    return result.canceled ? null : (result.filePath || null);
  } catch (error) {
    console.error('Failed to show save dialog:', error);
    return null;
  }
}

/**
 * Show open directory dialog
 */
export async function showOpenDirectoryDialog(options: { title?: string; defaultPath?: string } = {}): Promise<string | null> {
  try {
    if (!ipcClient.isAvailable()) {
      // Fallback - can't really do directory selection in browser
      return null;
    }

    const result = await ipcClient.invoke<{
      canceled: boolean;
      filePaths: string[];
      filePath: string | null;
    }>(IPCChannels.DIALOG.SHOW_OPEN_DIRECTORY_DIALOG, options);

    return result.canceled ? null : (result.filePath || null);
  } catch (error) {
    console.error('Failed to show directory dialog:', error);
    return null;
  }
}
