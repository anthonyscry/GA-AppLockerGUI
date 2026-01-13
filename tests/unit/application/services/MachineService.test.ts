/**
 * MachineService Unit Tests
 */

import { MachineService } from '../../../../src/application/services/MachineService';
import { IMachineRepository } from '../../../../src/domain/interfaces/IMachineRepository';
import { MachineScan } from '../../../../src/shared/types';
import { createMockMachine } from '../../../helpers/mockFactories';

describe('MachineService', () => {
  let service: MachineService;
  let mockRepository: jest.Mocked<IMachineRepository>;

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByFilter: jest.fn(),
      startScan: jest.fn(),
    } as any;

    service = new MachineService(mockRepository);
  });

  describe('getAllMachines', () => {
    it('should return all machines from repository', async () => {
      const mockMachines: MachineScan[] = [
        createMockMachine({ id: '1', hostname: 'WKST-001' }),
        createMockMachine({ id: '2', hostname: 'WKST-002' }),
      ];

      mockRepository.findAll.mockResolvedValue(mockMachines);

      const result = await service.getAllMachines();

      expect(result).toEqual(mockMachines);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should handle empty results', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.getAllMachines();

      expect(result).toEqual([]);
    });
  });

  describe('getMachineById', () => {
    it('should return machine by id', async () => {
      const mockMachine = createMockMachine({ id: '1' });
      mockRepository.findById.mockResolvedValue(mockMachine);

      const result = await service.getMachineById('1');

      expect(result).toEqual(mockMachine);
      expect(mockRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should return null if machine not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getMachineById('999');

      expect(result).toBeNull();
    });
  });

  describe('filterMachines', () => {
    it('should filter machines by criteria', async () => {
      const mockMachines: MachineScan[] = [
        createMockMachine({ hostname: 'WKST-001', status: 'Online' }),
        createMockMachine({ hostname: 'WKST-002', status: 'Offline' }),
      ];

      mockRepository.findByFilter.mockResolvedValue([mockMachines[0]]);

      const result = await service.filterMachines(mockMachines, {
        status: 'Online',
      });

      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe('WKST-001');
    });
  });

  describe('startBatchScan', () => {
    it('should start batch scan with options', async () => {
      const options = { targetOUs: ['OU=Workstations'], timeout: 30000 };
      mockRepository.startScan.mockResolvedValue();

      await service.startBatchScan(options);

      expect(mockRepository.startScan).toHaveBeenCalledWith(options);
    });

    it('should start scan with empty options', async () => {
      mockRepository.startScan.mockResolvedValue();

      await service.startBatchScan();

      expect(mockRepository.startScan).toHaveBeenCalledWith({});
    });
  });
});
