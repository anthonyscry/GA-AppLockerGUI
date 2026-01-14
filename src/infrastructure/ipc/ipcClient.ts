/**
 * IPC Client
 * Type-safe client for Electron IPC communication from renderer process
 */

import { IPCChannel } from './channels';

// Default timeout for IPC calls (2 minutes)
const DEFAULT_IPC_TIMEOUT = 120000;

// Extended timeout channels (operations that take longer)
const EXTENDED_TIMEOUT_CHANNELS = [
  'machine:startScan',
  'scan:local',
  'policy:deploy',
  'compliance:generateEvidence',
];

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

/**
 * Create a timeout promise that rejects after the specified duration
 */
function createTimeoutPromise<T>(ms: number, channel: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`IPC call to '${channel}' timed out after ${ms}ms`));
    }, ms);
  });
}

export class IPCClient {
  /**
   * Invoke an IPC method and wait for response with timeout protection
   * @param channel IPC channel to invoke
   * @param args Arguments to pass to the channel
   * @returns Promise resolving to the response
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

    // Determine timeout based on channel type
    const isExtendedTimeout = EXTENDED_TIMEOUT_CHANNELS.some(c => channel.startsWith(c));
    const timeout = isExtendedTimeout ? 600000 : DEFAULT_IPC_TIMEOUT; // 10 min or 2 min

    try {
      // Race between the actual IPC call and a timeout
      const result = await Promise.race([
        window.electron.ipc.invoke<T>(channel, ...args),
        createTimeoutPromise<T>(timeout, channel),
      ]);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`IPC call failed for channel ${channel}:`, errorMessage);
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
