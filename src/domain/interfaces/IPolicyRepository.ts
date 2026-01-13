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
}
