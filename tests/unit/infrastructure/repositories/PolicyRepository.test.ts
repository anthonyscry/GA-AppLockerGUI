/**
 * PolicyRepository Unit Tests
 */

import { PolicyRepository } from '../../../../src/infrastructure/repositories/PolicyRepository';
import { ipcClient } from '../../../../src/infrastructure/ipc/ipcClient';
import { PolicyPhase } from '../../../../src/shared/types';

jest.mock('../../../../src/infrastructure/ipc/ipcClient');

describe('PolicyRepository', () => {
  let repository: PolicyRepository;
  const mockIpcClient = ipcClient as jest.Mocked<typeof ipcClient>;

  beforeEach(() => {
    repository = new PolicyRepository();
    jest.clearAllMocks();
  });

  describe('runHealthCheck', () => {
    it('should run health check via IPC', async () => {
      const mockResult = {
        critical: 0,
        warning: 2,
        info: 4,
        score: 86,
      };

      mockIpcClient.invoke.mockResolvedValue(mockResult);

      const result = await repository.runHealthCheck(PolicyPhase.PHASE_1);

      expect(result).toEqual(mockResult);
      expect(mockIpcClient.invoke).toHaveBeenCalledWith('policy:runHealthCheck', PolicyPhase.PHASE_1);
    });
  });

  describe('getInventory', () => {
    it('should fetch inventory via IPC', async () => {
      const mockInventory = [];
      mockIpcClient.invoke.mockResolvedValue(mockInventory);

      const result = await repository.getInventory();

      expect(result).toEqual(mockInventory);
      expect(mockIpcClient.invoke).toHaveBeenCalledWith('policy:getInventory');
    });
  });
});
