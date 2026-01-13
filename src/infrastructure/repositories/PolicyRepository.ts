/**
 * Policy Repository Implementation
 */

import { IPolicyRepository, PolicyFilter } from '../../domain/interfaces/IPolicyRepository';
import { PolicyPhase, InventoryItem, TrustedPublisher, PolicyRule } from '../../shared/types';
import { ipcClient } from '../ipc/ipcClient';
import { IPCChannels } from '../ipc/channels';
import { logger } from '../logging/Logger';
import { ExternalServiceError } from '../../domain/errors';
import { cacheManager } from '../cache/CacheManager';

export class PolicyRepository implements IPolicyRepository {
  async getInventory(): Promise<InventoryItem[]> {
    // Check cache first
    const cacheKey = 'policy:inventory';
    const cached = cacheManager.get<InventoryItem[]>(cacheKey);
    if (cached) {
      logger.debug('Returning cached inventory');
      return cached;
    }

    try {
      const inventory = await ipcClient.invoke<InventoryItem[]>(IPCChannels.POLICY.GET_INVENTORY);
      const result = inventory || [];
      // Cache for 5 minutes
      cacheManager.set(cacheKey, result, 300000);
      return result;
    } catch (error) {
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning empty inventory');
        return [];
      }
      logger.error('Failed to fetch inventory', error as Error);
      throw new ExternalServiceError('Policy Service', 'Failed to fetch inventory', error as Error);
    }
  }

  async getTrustedPublishers(): Promise<TrustedPublisher[]> {
    // Check cache first
    const cacheKey = 'policy:trustedPublishers';
    const cached = cacheManager.get<TrustedPublisher[]>(cacheKey);
    if (cached) {
      logger.debug('Returning cached trusted publishers');
      return cached;
    }

    try {
      const publishers = await ipcClient.invoke<TrustedPublisher[]>(IPCChannels.POLICY.GET_TRUSTED_PUBLISHERS);
      const result = publishers || [];
      // Cache for 10 minutes (publishers change infrequently)
      cacheManager.set(cacheKey, result, 600000);
      return result;
    } catch (error) {
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning empty publishers list');
        return [];
      }
      logger.error('Failed to fetch trusted publishers', error as Error);
      throw new ExternalServiceError('Policy Service', 'Failed to fetch trusted publishers', error as Error);
    }
  }

  async getAppLockerGroups(): Promise<string[]> {
    try {
      const groups = await ipcClient.invoke<string[]>(IPCChannels.POLICY.GET_GROUPS);
      return groups || [];
    } catch (error) {
      logger.error('Failed to fetch AppLocker groups', error as Error);
      throw new ExternalServiceError('Policy Service', 'Failed to fetch AppLocker groups', error as Error);
    }
  }

  async createRule(rule: PolicyRule): Promise<PolicyRule> {
    try {
      logger.info('Creating policy rule', { ruleId: rule.id });
      const created = await ipcClient.invoke<PolicyRule>(IPCChannels.POLICY.CREATE_RULE, rule);
      logger.info('Policy rule created successfully', { ruleId: created.id });
      return created;
    } catch (error) {
      logger.error('Failed to create policy rule', error as Error);
      throw new ExternalServiceError('Policy Service', 'Failed to create policy rule', error as Error);
    }
  }

  async runHealthCheck(phase: PolicyPhase): Promise<{ critical: number; warning: number; info: number; score: number }> {
    try {
      logger.info('Running policy health check', { phase });
      const result = await ipcClient.invoke<{ critical: number; warning: number; info: number; score: number }>(
        IPCChannels.POLICY.RUN_HEALTH_CHECK,
        phase
      );
      return result;
    } catch (error) {
      logger.error('Failed to run health check', error as Error);
      throw new ExternalServiceError('Policy Service', 'Failed to run health check', error as Error);
    }
  }

  async batchGenerateRules(
    items: InventoryItem[],
    outputPath: string,
    options?: {
      ruleAction?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
      groupByPublisher?: boolean;
    }
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      logger.info('Batch generating rules', { itemCount: items.length, outputPath });
      const result = await ipcClient.invoke<{ success: boolean; outputPath?: string; error?: string }>(
        IPCChannels.POLICY.BATCH_GENERATE_RULES,
        items,
        outputPath,
        options
      );
      return result;
    } catch (error) {
      logger.error('Failed to batch generate rules', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createPublisherRule(
    publisher: string,
    outputPath: string,
    options?: {
      action?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
    }
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      logger.info('Creating publisher rule', { publisher, outputPath });
      // Use the existing IPC channel from ipcHandlers.cjs
      const result = await (window as any).electron?.ipc?.invoke?.(
        'policy:createPublisherRule',
        { publisher, ...options },
        outputPath
      );
      return result || { success: false, error: 'IPC not available' };
    } catch (error) {
      logger.error('Failed to create publisher rule', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async batchCreatePublisherRules(
    publishers: string[],
    outputPath: string,
    options?: {
      action?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
    }
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      logger.info('Batch creating publisher rules', { publisherCount: publishers.length, outputPath });
      // Use the existing IPC channel from ipcHandlers.cjs
      const result = await (window as any).electron?.ipc?.invoke?.(
        'policy:batchCreatePublisherRules',
        publishers,
        outputPath,
        options
      );
      return result || { success: false, error: 'IPC not available' };
    } catch (error) {
      logger.error('Failed to batch create publisher rules', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
