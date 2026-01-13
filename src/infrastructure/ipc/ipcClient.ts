/**
 * IPC Client
 * Type-safe client for Electron IPC communication from renderer process
 */

import { IPCChannels, IPCChannel } from './channels';

declare global {
  interface Window {
    electron?: {
      ipc?: {
        invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
        on: (channel: string, callback: (...args: unknown[]) => void) => void;
        removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
      };
      platform?: string;
      version?: string;
    };
  }
}

export class IPCClient {
  /**
   * Invoke an IPC method and wait for response
   */
  async invoke<T = unknown>(channel: IPCChannel | string, ...args: unknown[]): Promise<T> {
    if (!window.electron?.ipc) {
      throw new Error('IPC not available. Make sure preload script is loaded.');
    }

    try {
      return await window.electron.ipc.invoke<T>(channel, ...args);
    } catch (error) {
      throw new Error(`IPC call failed for channel ${channel}: ${error}`);
    }
  }

  /**
   * Listen to IPC events
   */
  on(channel: IPCChannel | string, callback: (...args: unknown[]) => void): void {
    if (!window.electron?.ipc) {
      console.warn('IPC not available, cannot listen to events');
      return;
    }
    window.electron.ipc.on(channel, callback);
  }

  /**
   * Remove IPC event listener
   */
  removeListener(channel: IPCChannel | string, callback: (...args: unknown[]) => void): void {
    if (!window.electron?.ipc) {
      return;
    }
    window.electron.ipc.removeListener(channel, callback);
  }

  /**
   * Check if IPC is available
   */
  isAvailable(): boolean {
    return !!window.electron?.ipc;
  }

  /**
   * Get platform information
   */
  getPlatform(): string | undefined {
    return window.electron?.platform;
  }

  /**
   * Get Electron version
   */
  getVersion(): string | undefined {
    return window.electron?.version;
  }
}

export const ipcClient = new IPCClient();
