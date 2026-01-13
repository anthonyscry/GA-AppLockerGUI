/**
 * PolicyService Unit Tests
 */

import { PolicyService } from '../../../../src/application/services/PolicyService';
import { IPolicyRepository } from '../../../../src/domain/interfaces/IPolicyRepository';
import { PolicyPhase, InventoryItem, TrustedPublisher } from '../../../../src/shared/types';
import { createMockInventoryItem, createMockTrustedPublisher } from '../../../helpers/mockFactories';

describe('PolicyService', () => {
  let service: PolicyService;
  let mockRepository: jest.Mocked<IPolicyRepository>;

  beforeEach(() => {
    mockRepository = {
      runHealthCheck: jest.fn(),
      getInventory: jest.fn(),
      getTrustedPublishers: jest.fn(),
      getAppLockerGroups: jest.fn(),
      createRule: jest.fn(),
    } as any;

    service = new PolicyService(mockRepository);
  });

  describe('runHealthCheck', () => {
    it('should run health check for phase', async () => {
      const mockResult = {
        critical: 0,
        warning: 2,
        info: 4,
        score: 86,
      };

      mockRepository.runHealthCheck.mockResolvedValue(mockResult);

      const result = await service.runHealthCheck(PolicyPhase.PHASE_1);

      expect(result).toEqual(mockResult);
      expect(mockRepository.runHealthCheck).toHaveBeenCalledWith(PolicyPhase.PHASE_1);
    });
  });

  describe('getInventory', () => {
    it('should return inventory items', async () => {
      const mockItems: InventoryItem[] = [
        createMockInventoryItem({ id: '1', name: 'App1' }),
        createMockInventoryItem({ id: '2', name: 'App2' }),
      ];

      mockRepository.getInventory.mockResolvedValue(mockItems);

      const result = await service.getInventory();

      expect(result).toEqual(mockItems);
    });
  });

  describe('getTrustedPublishers', () => {
    it('should return trusted publishers', async () => {
      const mockPublishers: TrustedPublisher[] = [
        createMockTrustedPublisher({ id: '1', name: 'Microsoft' }),
      ];

      mockRepository.getTrustedPublishers.mockResolvedValue(mockPublishers);

      const result = await service.getTrustedPublishers();

      expect(result).toEqual(mockPublishers);
    });
  });

  describe('getPublisherCategories', () => {
    it('should return unique categories', async () => {
      const mockPublishers: TrustedPublisher[] = [
        createMockTrustedPublisher({ category: 'Software Vendor' }),
        createMockTrustedPublisher({ category: 'Software Vendor' }),
        createMockTrustedPublisher({ category: 'Enterprise' }),
      ];

      mockRepository.getTrustedPublishers.mockResolvedValue(mockPublishers);

      const result = await service.getPublisherCategories();

      expect(result).toContain('All');
      expect(result).toContain('Software Vendor');
      expect(result).toContain('Enterprise');
      expect(result.filter(c => c === 'Software Vendor')).toHaveLength(1);
    });
  });

  describe('createRule', () => {
    it('should create a policy rule', async () => {
      const mockItem = createMockInventoryItem();
      const mockRule = {
        id: 'rule-1',
        name: mockItem.name,
        type: 'Publisher' as const,
        category: 'EXE',
        status: 'Allow' as const,
        user: 'GA-ASI\\AppLocker-Exe-Allow',
      };

      mockRepository.createRule.mockResolvedValue(mockRule);

      const result = await service.createRule({
        action: 'Allow',
        ruleType: 'Publisher',
        targetGroup: 'GA-ASI\\AppLocker-Exe-Allow',
        subject: mockItem,
      });

      expect(result).toEqual(mockRule);
      expect(mockRepository.createRule).toHaveBeenCalled();
    });
  });

  describe('generateRuleXML', () => {
    it('should generate Publisher rule XML', () => {
      const mockItem = createMockInventoryItem({
        name: 'Test App',
        publisher: 'O=TEST PUBLISHER',
      });

      const xml = service.generateRuleXML({
        action: 'Allow',
        ruleType: 'Publisher',
        targetGroup: 'GA-ASI\\AppLocker-Exe-Allow',
        subject: mockItem,
      });

      expect(xml).toContain('FilePublisherRule');
      expect(xml).toContain('Test-App');
      expect(xml).toContain('Allow');
      expect(xml).toContain('O=TEST PUBLISHER');
    });
  });
});
