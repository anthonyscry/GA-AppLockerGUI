/**
 * ADService Unit Tests
 */

import { ADService } from '../../../../src/application/services/ADService';
import { IADRepository } from '../../../../src/domain/interfaces/IADRepository';
import { ADUser } from '../../../../src/shared/types';
import { createMockADUser } from '../../../helpers/mockFactories';

describe('ADService', () => {
  let service: ADService;
  let mockRepository: jest.Mocked<IADRepository>;

  beforeEach(() => {
    mockRepository = {
      getAllUsers: jest.fn(),
      getUserById: jest.fn(),
      findByFilter: jest.fn(),
      addUserToGroup: jest.fn(),
      removeUserFromGroup: jest.fn(),
      getAppLockerGroups: jest.fn(),
      getWinRMGPOStatus: jest.fn(),
      toggleWinRMGPO: jest.fn(),
    } as any;

    service = new ADService(mockRepository);
  });

  describe('getAllUsers', () => {
    it('should return all AD users', async () => {
      const mockUsers: ADUser[] = [
        createMockADUser({ id: '1', samAccountName: 'user1' }),
        createMockADUser({ id: '2', samAccountName: 'user2' }),
      ];

      mockRepository.getAllUsers.mockResolvedValue(mockUsers);

      const result = await service.getAllUsers();

      expect(result).toEqual(mockUsers);
      expect(mockRepository.getAllUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const mockUser = createMockADUser({ id: '1' });
      mockRepository.getUserById.mockResolvedValue(mockUser);

      const result = await service.getUserById('1');

      expect(result).toEqual(mockUser);
      expect(mockRepository.getUserById).toHaveBeenCalledWith('1');
    });
  });

  describe('addUserToGroup', () => {
    it('should add user to group', async () => {
      mockRepository.addUserToGroup.mockResolvedValue();

      await service.addUserToGroup('user-1', 'GA-ASI\\AppLocker-Exe-Allow');

      expect(mockRepository.addUserToGroup).toHaveBeenCalledWith(
        'user-1',
        'GA-ASI\\AppLocker-Exe-Allow'
      );
    });
  });

  describe('removeUserFromGroup', () => {
    it('should remove user from group', async () => {
      mockRepository.removeUserFromGroup.mockResolvedValue();

      await service.removeUserFromGroup('user-1', 'GA-ASI\\AppLocker-Exe-Allow');

      expect(mockRepository.removeUserFromGroup).toHaveBeenCalledWith(
        'user-1',
        'GA-ASI\\AppLocker-Exe-Allow'
      );
    });
  });

  describe('getAppLockerGroups', () => {
    it('should return AppLocker groups', async () => {
      const mockGroups = ['GA-ASI\\AppLocker-Exe-Allow', 'GA-ASI\\AppLocker-Exe-Deny'];
      mockRepository.getAppLockerGroups.mockResolvedValue(mockGroups);

      const result = await service.getAppLockerGroups();

      expect(result).toEqual(mockGroups);
    });
  });

  describe('toggleWinRMGPO', () => {
    it('should enable WinRM GPO', async () => {
      mockRepository.toggleWinRMGPO.mockResolvedValue();

      await service.toggleWinRMGPO(true);

      expect(mockRepository.toggleWinRMGPO).toHaveBeenCalledWith(true);
    });

    it('should disable WinRM GPO', async () => {
      mockRepository.toggleWinRMGPO.mockResolvedValue();

      await service.toggleWinRMGPO(false);

      expect(mockRepository.toggleWinRMGPO).toHaveBeenCalledWith(false);
    });
  });
});
