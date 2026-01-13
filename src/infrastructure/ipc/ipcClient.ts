/**
 * IPC Client
 * Type-safe client for Electron IPC communication from renderer process
 */

import { IPCChannel } from './channels';

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
      // Gracefully handle browser mode - return empty/default values instead of throwing
      console.warn(`IPC not available (browser mode). Channel: ${channel}`);
      // Return appropriate defaults based on channel type
      if (channel.startsWith('machine:')) {
        return [] as unknown as T;
      }
      if (channel.startsWith('event:')) {
        return { total: 0, allowed: 0, blocked: 0 } as unknown as T;
      }
      if (channel.startsWith('policy:')) {
        return [] as unknown as T;
      }
      if (channel.startsWith('ad:')) {
        return [] as unknown as T;
      }
      if (channel.startsWith('compliance:')) {
        return { status: 'unknown' } as unknown as T;
      }
      return undefined as unknown as T;
    }

    try {
      return await window.electron.ipc.invoke<T>(channel, ...args);
    } catch (error) {
      console.error(`IPC call failed for channel ${channel}:`, error);
      // Return defaults instead of throwing to prevent app crash
      return undefined as unknown as T;
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
