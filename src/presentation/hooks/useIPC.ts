/**
 * useIPC Hook
 * React hook for IPC communication
 */

import { useCallback } from 'react';
import { ipcClient, IPCChannel } from '../../infrastructure/ipc';

export function useIPC() {
  const invoke = useCallback(<T = unknown>(channel: IPCChannel | string, ...args: unknown[]): Promise<T> => {
    return ipcClient.invoke<T>(channel, ...args);
  }, []);

  const on = useCallback((channel: IPCChannel | string, callback: (...args: unknown[]) => void) => {
    ipcClient.on(channel, callback);
    return () => ipcClient.removeListener(channel, callback);
  }, []);

  return {
    invoke,
    on,
    isAvailable: ipcClient.isAvailable(),
    platform: ipcClient.getPlatform(),
    version: ipcClient.getVersion(),
  };
}
