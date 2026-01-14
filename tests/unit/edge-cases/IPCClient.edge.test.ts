/**
 * IPC Client Edge Case Tests
 * Tests for timeout handling, graceful degradation, and error scenarios
 */

describe('IPCClient Edge Cases', () => {
  let originalWindow: typeof window;

  beforeEach(() => {
    originalWindow = global.window;
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.window = originalWindow;
    jest.useRealTimers();
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running standard IPC calls after 2 minutes', async () => {
      // Setup window with mock IPC that never resolves
      global.window = {
        electron: {
          ipc: {
            invoke: jest.fn().mockImplementation(() => new Promise(() => {})),
            on: jest.fn(),
            removeListener: jest.fn(),
          },
        },
      } as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const resultPromise = client.invoke('event:getAll');

      // Fast-forward past the 2 minute timeout
      jest.advanceTimersByTime(120001);

      const result = await resultPromise;

      // Should return undefined (graceful degradation)
      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('event:getAll'),
        expect.stringContaining('timed out')
      );

      errorSpy.mockRestore();
    });

    it('should use extended timeout for scan operations', async () => {
      global.window = {
        electron: {
          ipc: {
            invoke: jest.fn().mockImplementation(() => new Promise(() => {})),
            on: jest.fn(),
            removeListener: jest.fn(),
          },
        },
      } as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const resultPromise = client.invoke('machine:startScan');

      // Fast-forward 3 minutes - should NOT timeout yet for extended operations
      jest.advanceTimersByTime(180000);

      // Check that error wasn't logged yet
      expect(errorSpy).not.toHaveBeenCalled();

      // Fast-forward to just past 10 minutes
      jest.advanceTimersByTime(420001);

      await resultPromise;

      // Now it should have timed out
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('should return result if IPC completes before timeout', async () => {
      const expectedResult = { data: 'test' };

      global.window = {
        electron: {
          ipc: {
            invoke: jest.fn().mockResolvedValue(expectedResult),
            on: jest.fn(),
            removeListener: jest.fn(),
          },
        },
      } as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const result = await client.invoke('test:channel');

      expect(result).toEqual(expectedResult);
    });
  });

  describe('Browser Mode Graceful Degradation', () => {
    beforeEach(() => {
      global.window = {} as any;
    });

    it('should return empty array for machine channels', async () => {
      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await client.invoke('machine:getAll');

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('browser mode'));

      warnSpy.mockRestore();
    });

    it('should return stats object for event channels', async () => {
      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const result = await client.invoke('event:stats');

      expect(result).toEqual({ total: 0, allowed: 0, blocked: 0 });
    });

    it('should return empty array for policy channels', async () => {
      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const result = await client.invoke('policy:getInventory');

      expect(result).toEqual([]);
    });

    it('should return empty array for ad channels', async () => {
      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const result = await client.invoke('ad:getUsers');

      expect(result).toEqual([]);
    });

    it('should return status object for compliance channels', async () => {
      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const result = await client.invoke('compliance:status');

      expect(result).toEqual({ status: 'unknown' });
    });

    it('should return undefined for unknown channel types', async () => {
      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const result = await client.invoke('unknown:channel');

      expect(result).toBeUndefined();
    });
  });

  describe('IPC Availability Check', () => {
    it('should return true when IPC is available', () => {
      global.window = {
        electron: {
          ipc: {
            invoke: jest.fn(),
            on: jest.fn(),
            removeListener: jest.fn(),
          },
        },
      } as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      expect(client.isAvailable()).toBe(true);
    });

    it('should return false when window.electron is undefined', () => {
      global.window = {} as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      expect(client.isAvailable()).toBe(false);
    });

    it('should return false when window.electron.ipc is undefined', () => {
      global.window = { electron: {} } as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      expect(client.isAvailable()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return undefined and log error when IPC throws', async () => {
      const testError = new Error('IPC Error');

      global.window = {
        electron: {
          ipc: {
            invoke: jest.fn().mockRejectedValue(testError),
            on: jest.fn(),
            removeListener: jest.fn(),
          },
        },
      } as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await client.invoke('test:channel');

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('test:channel'),
        'IPC Error'
      );

      errorSpy.mockRestore();
    });

    it('should handle non-Error thrown values', async () => {
      global.window = {
        electron: {
          ipc: {
            invoke: jest.fn().mockRejectedValue('string error'),
            on: jest.fn(),
            removeListener: jest.fn(),
          },
        },
      } as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await client.invoke('test:channel');

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('test:channel'),
        'string error'
      );

      errorSpy.mockRestore();
    });
  });

  describe('Event Listeners', () => {
    it('should not throw when adding listener without IPC', () => {
      global.window = {} as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(() => client.on('test:channel', () => {})).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should not throw when removing listener without IPC', () => {
      global.window = {} as any;

      const { IPCClient } = require('../../../src/infrastructure/ipc/ipcClient');
      const client = new IPCClient();

      expect(() => client.removeListener('test:channel', () => {})).not.toThrow();
    });
  });
});
