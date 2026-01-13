/**
 * Policy Repository Interface
 */

import { PolicyPhase, InventoryItem, TrustedPublisher, PolicyRule } from '../../shared/types';

export interface PolicyFilter {
  searchQuery?: string;
  category?: string;
}

export interface IPolicyRepository {
  getInventory(): Promise<InventoryItem[]>;
  getTrustedPublishers(): Promise<TrustedPublisher[]>;
  getAppLockerGroups(): Promise<string[]>;
  createRule(rule: PolicyRule): Promise<PolicyRule>;
  runHealthCheck(phase: PolicyPhase): Promise<{ critical: number; warning: number; info: number; score: number }>;
  batchGenerateRules(
    items: InventoryItem[],
    outputPath: string,
    options?: {
      ruleAction?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
      groupByPublisher?: boolean;
    }
  ): Promise<{ success: boolean; outputPath?: string; error?: string }>;
  createPublisherRule(
    publisher: string,
    outputPath: string,
    options?: {
      action?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
    }
  ): Promise<{ success: boolean; outputPath?: string; error?: string }>;
  batchCreatePublisherRules(
    publishers: string[],
    outputPath: string,
    options?: {
      action?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
    }
  ): Promise<{ success: boolean; outputPath?: string; error?: string }>;
}
