/**
 * Window type extensions for Electron IPC
 */

interface ElectronIPC {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
}

interface ElectronAPI {
  platform: string;
  version: string;
  ipc: ElectronIPC;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
