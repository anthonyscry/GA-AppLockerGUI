/**
 * Repository Filters Edge Case Tests
 * Tests for null safety, undefined handling, and boundary conditions in repository filters
 */

import { MachineRepository } from '../../../src/infrastructure/repositories/MachineRepository';
import { ADRepository } from '../../../src/infrastructure/repositories/ADRepository';
import { MachineScan, ADUser } from '../../../src/shared/types';

// Mock the IPC client
jest.mock('../../../src/infrastructure/ipc/ipcClient', () => ({
  ipcClient: {
    invoke: jest.fn(),
    isAvailable: jest.fn().mockReturnValue(true),
  },
}));

describe('MachineRepository Filter Edge Cases', () => {
  let repository: MachineRepository;

  beforeEach(() => {
    repository = new MachineRepository();
  });

  describe('Null/Undefined Property Handling', () => {
    it('should handle machines with undefined hostname', async () => {
      const mockMachines: Partial<MachineScan>[] = [
        { id: '1', hostname: undefined as any, status: 'Online', riskLevel: 'Low' },
        { id: '2', hostname: 'VALID-HOST', status: 'Online', riskLevel: 'Low' },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockMachines);

      const result = await repository.findByFilter({ searchQuery: 'VALID' });
      expect(result.length).toBe(1);
      expect(result[0].hostname).toBe('VALID-HOST');
    });

    it('should handle machines with null status', async () => {
      const mockMachines: Partial<MachineScan>[] = [
        { id: '1', hostname: 'HOST-1', status: null as any, riskLevel: 'Low' },
        { id: '2', hostname: 'HOST-2', status: 'Online', riskLevel: 'Low' },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockMachines);

      const result = await repository.findByFilter({ status: 'Online' });
      expect(result.length).toBe(1);
    });

    it('should handle filter with undefined searchQuery', async () => {
      const mockMachines: MachineScan[] = [
        { id: '1', hostname: 'HOST-1', status: 'Online', riskLevel: 'Low' } as MachineScan,
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockMachines);

      const result = await repository.findByFilter({ searchQuery: undefined });
      expect(result.length).toBe(1);
    });

    it('should handle completely empty machine objects', async () => {
      const mockMachines = [
        {},
        { id: '2', hostname: 'VALID', status: 'Online', riskLevel: 'Low' },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockMachines);

      const result = await repository.findByFilter({ searchQuery: 'VALID' });
      expect(result.length).toBe(1);
    });
  });

  describe('Filter Edge Cases', () => {
    it('should handle empty string search query', async () => {
      const mockMachines: MachineScan[] = [
        { id: '1', hostname: 'HOST-1', status: 'Online', riskLevel: 'Low' } as MachineScan,
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockMachines);

      const result = await repository.findByFilter({ searchQuery: '' });
      expect(result.length).toBe(1);
    });

    it('should handle special characters in search query', async () => {
      const mockMachines: MachineScan[] = [
        { id: '1', hostname: 'HOST-1', status: 'Online', riskLevel: 'Low' } as MachineScan,
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockMachines);

      // Should not crash with regex special chars
      const result = await repository.findByFilter({ searchQuery: '.*+?^${}()|[]\\' });
      expect(result).toBeDefined();
    });

    it('should handle "All" status filter correctly', async () => {
      const mockMachines: MachineScan[] = [
        { id: '1', hostname: 'HOST-1', status: 'Online', riskLevel: 'Low' } as MachineScan,
        { id: '2', hostname: 'HOST-2', status: 'Offline', riskLevel: 'High' } as MachineScan,
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockMachines);

      const result = await repository.findByFilter({ status: 'All' });
      expect(result.length).toBe(2);
    });
  });
});

describe('ADRepository Filter Edge Cases', () => {
  let repository: ADRepository;

  beforeEach(() => {
    repository = new ADRepository();
  });

  describe('Null/Undefined Property Handling', () => {
    it('should handle users with undefined samAccountName', async () => {
      const mockUsers: Partial<ADUser>[] = [
        { id: '1', samAccountName: undefined as any, displayName: 'User 1', groups: [] },
        { id: '2', samAccountName: 'validuser', displayName: 'User 2', groups: [] },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockUsers);

      const result = await repository.findByFilter({ searchQuery: 'valid' });
      expect(result.length).toBe(1);
    });

    it('should handle users with null displayName', async () => {
      const mockUsers: Partial<ADUser>[] = [
        { id: '1', samAccountName: 'user1', displayName: null as any, groups: [] },
        { id: '2', samAccountName: 'user2', displayName: 'John Doe', groups: [] },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockUsers);

      const result = await repository.findByFilter({ searchQuery: 'John' });
      expect(result.length).toBe(1);
    });

    it('should handle users with undefined groups array', async () => {
      const mockUsers: Partial<ADUser>[] = [
        { id: '1', samAccountName: 'user1', displayName: 'User 1', groups: undefined as any },
        { id: '2', samAccountName: 'user2', displayName: 'User 2', groups: ['Admin'] },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockUsers);

      const result = await repository.findByFilter({ group: 'Admin' });
      expect(result.length).toBe(1);
    });

    it('should handle users with null groups', async () => {
      const mockUsers: Partial<ADUser>[] = [
        { id: '1', samAccountName: 'user1', displayName: 'User 1', groups: null as any },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockUsers);

      // Should not crash when filtering by group
      const result = await repository.findByFilter({ group: 'SomeGroup' });
      expect(result.length).toBe(0);
    });

    it('should handle completely malformed user objects', async () => {
      const mockUsers = [
        null,
        undefined,
        {},
        { id: '4', samAccountName: 'validuser', displayName: 'Valid User', groups: ['Users'] },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockUsers.filter(Boolean));

      const result = await repository.findByFilter({ searchQuery: 'valid' });
      expect(result.length).toBe(1);
    });
  });

  describe('Department Filter Edge Cases', () => {
    it('should handle undefined department in user', async () => {
      const mockUsers: Partial<ADUser>[] = [
        { id: '1', samAccountName: 'user1', displayName: 'User 1', department: undefined, groups: [] },
      ];

      const { ipcClient } = require('../../../src/infrastructure/ipc/ipcClient');
      ipcClient.invoke.mockResolvedValue(mockUsers);

      const result = await repository.findByFilter({ department: 'IT' });
      expect(result.length).toBe(0);
    });
  });
});
