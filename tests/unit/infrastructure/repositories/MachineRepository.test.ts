/**
 * MachineRepository Unit Tests
 */

import { MachineRepository } from '../../../../src/infrastructure/repositories/MachineRepository';
import { ipcClient } from '../../../../src/infrastructure/ipc/ipcClient';
import { MachineScan } from '../../../../src/shared/types';
import { createMockMachine } from '../../../helpers/mockFactories';

jest.mock('../../../../src/infrastructure/ipc/ipcClient');

describe('MachineRepository', () => {
  let repository: MachineRepository;
  const mockIpcClient = ipcClient as jest.Mocked<typeof ipcClient>;

  beforeEach(() => {
    repository = new MachineRepository();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all machines via IPC', async () => {
      const mockMachines: MachineScan[] = [
        createMockMachine({ id: '1' }),
        createMockMachine({ id: '2' }),
      ];

      mockIpcClient.invoke.mockResolvedValue(mockMachines);

      const result = await repository.findAll();

      expect(result).toEqual(mockMachines);
      expect(mockIpcClient.invoke).toHaveBeenCalledWith('machine:getAll');
    });

    it('should return empty array when IPC not available (browser mode)', async () => {
      mockIpcClient.invoke.mockRejectedValue(new Error('IPC error'));
      mockIpcClient.isAvailable = jest.fn().mockReturnValue(false);

      const result = await repository.findAll();
      expect(result).toEqual([]);
    });

    it('should throw when IPC is available but fails', async () => {
      mockIpcClient.invoke.mockRejectedValue(new Error('IPC error'));
      mockIpcClient.isAvailable = jest.fn().mockReturnValue(true);

      await expect(repository.findAll()).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should fetch machine by id via IPC', async () => {
      const mockMachine = createMockMachine({ id: '1' });
      mockIpcClient.invoke.mockResolvedValue(mockMachine);

      const result = await repository.findById('1');

      expect(result).toEqual(mockMachine);
      expect(mockIpcClient.invoke).toHaveBeenCalledWith('machine:getById', '1');
    });
  });
});
