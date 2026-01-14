/**
 * PolicyService Edge Case Tests
 * Tests for batch operations, array validation, and boundary conditions
 */

import { PolicyService } from '../../../src/application/services/PolicyService';
import { IPolicyRepository } from '../../../src/domain/interfaces/IPolicyRepository';
import { InventoryItem, TrustedPublisher, PolicyRule, PolicyPhase } from '../../../src/shared/types';

describe('PolicyService Edge Cases', () => {
  let service: PolicyService;
  let mockRepository: jest.Mocked<IPolicyRepository>;

  beforeEach(() => {
    mockRepository = {
      runHealthCheck: jest.fn(),
      getInventory: jest.fn(),
      getTrustedPublishers: jest.fn(),
      getAppLockerGroups: jest.fn(),
      createRule: jest.fn(),
      batchGenerateRules: jest.fn(),
      createPublisherRule: jest.fn(),
      batchCreatePublisherRules: jest.fn(),
      mergePolicies: jest.fn(),
      deployPolicy: jest.fn(),
    } as unknown as jest.Mocked<IPolicyRepository>;

    service = new PolicyService(mockRepository);
  });

  describe('batchGenerateRules Validation', () => {
    it('should reject non-array items parameter', async () => {
      const result = await service.batchGenerateRules(
        'not-an-array' as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be an array');
      expect(mockRepository.batchGenerateRules).not.toHaveBeenCalled();
    });

    it('should reject null items parameter', async () => {
      const result = await service.batchGenerateRules(
        null as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    it('should reject undefined items parameter', async () => {
      const result = await service.batchGenerateRules(
        undefined as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    it('should reject empty array', async () => {
      const result = await service.batchGenerateRules([], '/output/path', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No items provided');
      expect(mockRepository.batchGenerateRules).not.toHaveBeenCalled();
    });

    it('should filter out invalid items from array', async () => {
      mockRepository.batchGenerateRules.mockResolvedValue({
        success: true,
        outputPath: '/output/path',
      });

      const mixedItems = [
        null,
        undefined,
        { id: '1', name: '' }, // Empty name
        { id: '2', name: 'Valid Item', publisher: 'Test' },
        { id: '3' }, // Missing name
        'string-item', // Wrong type
        { id: '4', name: 'Another Valid', publisher: 'Test2' },
      ];

      const result = await service.batchGenerateRules(
        mixedItems as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(true);
      // Should only pass valid items to repository
      expect(mockRepository.batchGenerateRules).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Valid Item' }),
          expect.objectContaining({ name: 'Another Valid' }),
        ]),
        '/output/path',
        {}
      );
    });

    it('should reject when all items are invalid', async () => {
      const invalidItems = [
        null,
        undefined,
        { id: '1' }, // No name
        {},
      ];

      const result = await service.batchGenerateRules(
        invalidItems as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid items found');
    });
  });

  describe('batchCreatePublisherRules Validation', () => {
    it('should reject non-array publishers parameter', async () => {
      const result = await service.batchCreatePublisherRules(
        'not-an-array' as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    it('should reject null publishers parameter', async () => {
      const result = await service.batchCreatePublisherRules(
        null as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    it('should reject empty array', async () => {
      const result = await service.batchCreatePublisherRules([], '/output/path', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No publishers provided');
    });

    it('should filter out invalid publisher strings', async () => {
      mockRepository.batchCreatePublisherRules.mockResolvedValue({
        success: true,
        outputPath: '/output/path',
      });

      const mixedPublishers = [
        'Valid Publisher',
        '',
        '   ', // Whitespace only
        123 as any, // Number
        null,
        undefined,
        'Another Valid',
        { name: 'object' } as any, // Object
      ];

      const result = await service.batchCreatePublisherRules(
        mixedPublishers as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(true);
      expect(mockRepository.batchCreatePublisherRules).toHaveBeenCalledWith(
        ['Valid Publisher', 'Another Valid'],
        '/output/path',
        {}
      );
    });

    it('should reject publishers exceeding max length', async () => {
      const longPublisher = 'A'.repeat(2000); // Exceeds 1024 limit

      const result = await service.batchCreatePublisherRules(
        [longPublisher],
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid publisher names found');
    });

    it('should reject when all publishers are invalid', async () => {
      const invalidPublishers = [null, undefined, '', '   ', 123 as any];

      const result = await service.batchCreatePublisherRules(
        invalidPublishers as any,
        '/output/path',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid publisher names found');
    });
  });

  describe('generateRuleXML Security', () => {
    it('should reject subject name with control characters', () => {
      const options = {
        action: 'Allow' as const,
        ruleType: 'Publisher' as const,
        targetGroup: 'Users',
        subject: { name: 'Test\x00App', publisher: 'Valid' } as InventoryItem,
      };

      expect(() => service.generateRuleXML(options)).toThrow('prohibited characters');
    });

    it('should reject subject name with null bytes', () => {
      const options = {
        action: 'Allow' as const,
        ruleType: 'Publisher' as const,
        targetGroup: 'Users',
        subject: { name: 'Test\x00', publisher: 'Valid' } as InventoryItem,
      };

      expect(() => service.generateRuleXML(options)).toThrow('prohibited characters');
    });

    it('should reject empty subject name', () => {
      const options = {
        action: 'Allow' as const,
        ruleType: 'Publisher' as const,
        targetGroup: 'Users',
        subject: { name: '', publisher: 'Valid' } as InventoryItem,
      };

      expect(() => service.generateRuleXML(options)).toThrow('prohibited characters');
    });

    it('should reject subject name exceeding max length', () => {
      const options = {
        action: 'Allow' as const,
        ruleType: 'Publisher' as const,
        targetGroup: 'Users',
        subject: { name: 'A'.repeat(2000), publisher: 'Valid' } as InventoryItem,
      };

      expect(() => service.generateRuleXML(options)).toThrow('prohibited characters');
    });

    it('should reject invalid action values', () => {
      const options = {
        action: 'Execute' as any,
        ruleType: 'Publisher' as const,
        targetGroup: 'Users',
        subject: { name: 'TestApp', publisher: 'Valid' } as InventoryItem,
      };

      expect(() => service.generateRuleXML(options)).toThrow('Invalid action');
    });

    it('should escape XML special characters in output', () => {
      const options = {
        action: 'Allow' as const,
        ruleType: 'Publisher' as const,
        targetGroup: 'Users',
        subject: {
          id: '1',
          name: 'Test<App>',
          publisher: 'O="Test & Co", L=City',
          path: 'C:\\Program Files\\Test\\app.exe', // Required to identify as InventoryItem
          version: '1.0',
          type: 'EXE',
        } as InventoryItem,
      };

      const xml = service.generateRuleXML(options);
      expect(xml).toContain('&lt;');
      expect(xml).toContain('&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).not.toContain('<App>');
    });
  });

  describe('groupByPublisher Edge Cases', () => {
    it('should handle empty array', () => {
      const result = service.groupByPublisher([]);
      expect(result).toEqual({});
    });

    it('should handle items with undefined publisher', () => {
      const items = [
        { id: '1', name: 'App1', publisher: undefined } as any,
        { id: '2', name: 'App2', publisher: 'Known Publisher' } as InventoryItem,
      ];

      const result = service.groupByPublisher(items);
      expect(result['Unknown']).toHaveLength(1);
      expect(result['Known Publisher']).toHaveLength(1);
    });

    it('should handle items with null publisher', () => {
      const items = [
        { id: '1', name: 'App1', publisher: null } as any,
      ];

      const result = service.groupByPublisher(items);
      expect(result['Unknown']).toHaveLength(1);
    });

    it('should handle items with empty string publisher', () => {
      const items = [
        { id: '1', name: 'App1', publisher: '' } as InventoryItem,
      ];

      const result = service.groupByPublisher(items);
      expect(result['Unknown']).toHaveLength(1);
    });
  });

  describe('detectDuplicates Edge Cases', () => {
    it('should handle empty array', () => {
      const result = service.detectDuplicates([]);

      expect(result.pathDupCount).toBe(0);
      expect(result.pubDupCount).toBe(0);
      expect(result.totalItems).toBe(0);
    });

    it('should handle items with no path', () => {
      const items = [
        { id: '1', name: 'App1', publisher: 'Pub1' } as InventoryItem,
        { id: '2', name: 'App1', publisher: 'Pub1' } as InventoryItem,
      ];

      const result = service.detectDuplicates(items);
      expect(result.pubDupCount).toBe(1); // Same publisher+name = 1 duplicate group
    });

    it('should handle items with undefined path', () => {
      const items = [
        { id: '1', name: 'App1', publisher: 'Pub1', path: undefined } as any,
      ];

      expect(() => service.detectDuplicates(items)).not.toThrow();
    });
  });
});
