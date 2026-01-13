/**
 * Policy Repository Implementation
 */

import { IPolicyRepository, PolicyFilter } from '../../domain/interfaces/IPolicyRepository';
import { PolicyPhase, InventoryItem, TrustedPublisher, PolicyRule } from '../../shared/types';
import { ipcClient } from '../ipc/ipcClient';
import { IPCChannels } from '../ipc/channels';
import { logger } from '../logging/Logger';
import { ExternalServiceError } from '../../domain/errors';

export class PolicyRepository implements IPolicyRepository {
  async getInventory(): Promise<InventoryItem[]> {
    try {
      const inventory = await ipcClient.invoke<InventoryItem[]>(IPCChannels.POLICY.GET_INVENTORY);
      return inventory || [];
    } catch (error) {
      logger.error('Failed to fetch inventory', error as Error);
      throw new ExternalServiceError('Policy Service', 'Failed to fetch inventory', error as Error);
    }
  }

  async getTrustedPublishers(): Promise<TrustedPublisher[]> {
    try {
      const publishers = await ipcClient.invoke<TrustedPublisher[]>(IPCChannels.POLICY.GET_TRUSTED_PUBLISHERS);
      return publishers || [];
    } catch (error) {
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
}
