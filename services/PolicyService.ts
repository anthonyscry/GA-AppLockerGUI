/**
 * Policy Service
 * Handles AppLocker policy operations
 */

import { PolicyPhase, InventoryItem, TrustedPublisher, PolicyRule } from '../types';
import { MOCK_INVENTORY, COMMON_PUBLISHERS, APPLOCKER_GROUPS } from '../constants';

export interface HealthCheckResult {
  critical: number;
  warning: number;
  info: number;
  score: number;
}

export interface RuleCreationOptions {
  action: 'Allow' | 'Deny';
  ruleType: 'Publisher' | 'Path' | 'Hash';
  targetGroup: string;
  subject: InventoryItem | TrustedPublisher;
}

export interface PolicyFilter {
  searchQuery?: string;
  category?: string;
}

export class PolicyService {
  /**
   * Run policy health check
   */
  static async runHealthCheck(phase: PolicyPhase): Promise<HealthCheckResult> {
    // In production, this would execute Test-RuleHealth.ps1 via IPC
    // Simulated results based on documentation logic:
    // 100 - (20 * critical) - (5 * warning) - (1 * info)
    const critical = 0;
    const warning = 2;
    const info = 4;
    const score = 100 - (20 * critical) - (5 * warning) - (1 * info);
    
    return Promise.resolve({ critical, warning, info, score });
  }

  /**
   * Filter inventory items
   */
  static filterInventory(
    items: InventoryItem[], 
    filter: PolicyFilter
  ): InventoryItem[] {
    return items.filter(item => {
      const matchesSearch = !filter.searchQuery ||
        item.name.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        item.publisher.toLowerCase().includes(filter.searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }

  /**
   * Filter trusted publishers
   */
  static filterPublishers(
    publishers: TrustedPublisher[], 
    filter: PolicyFilter
  ): TrustedPublisher[] {
    return publishers.filter(p => {
      const matchesSearch = !filter.searchQuery ||
        p.name.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        p.publisherName.toLowerCase().includes(filter.searchQuery.toLowerCase());
      
      const matchesCategory = !filter.category || filter.category === 'All' ||
        p.category === filter.category;
      
      return matchesSearch && matchesCategory;
    });
  }

  /**
   * Get all inventory items
   */
  static async getInventory(): Promise<InventoryItem[]> {
    return Promise.resolve([]);
  }

  /**
   * Get all trusted publishers
   */
  static async getTrustedPublishers(): Promise<TrustedPublisher[]> {
    return Promise.resolve(COMMON_PUBLISHERS);
  }

  /**
   * Get available AppLocker groups
   */
  static async getAppLockerGroups(): Promise<string[]> {
    return Promise.resolve(APPLOCKER_GROUPS);
  }

  /**
   * Get unique categories from publishers
   */
  static getPublisherCategories(publishers: TrustedPublisher[]): string[] {
    return ['All', ...Array.from(new Set(publishers.map(p => p.category)))];
  }

  /**
   * Generate AppLocker XML rule
   */
  static generateRuleXML(options: RuleCreationOptions): string {
    const { action, ruleType, targetGroup, subject } = options;
    const subjectName = 'name' in subject ? subject.name : subject.name;
    const publisherName = 'publisher' in subject 
      ? subject.publisher 
      : subject.publisherName;
    
    const ruleId = Math.random().toString(36).substr(2, 9);
    const ruleName = subjectName.replace(/\s/g, '-');
    
    if (ruleType === 'Publisher') {
      return `<FilePublisherRule Id="${ruleId}" Name="${ruleName}" Action="${action}">
  <Conditions>
    <PublisherCondition PublisherName="${publisherName}" ... />
  </Conditions>
</FilePublisherRule>`;
    }
    
    // Add other rule types as needed
    return '';
  }

  /**
   * Create a new policy rule
   */
  static async createRule(options: RuleCreationOptions): Promise<PolicyRule> {
    // In production, this would commit to AD via PowerShell/Electron IPC
    const rule: PolicyRule = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'name' in options.subject ? options.subject.name : options.subject.name,
      type: options.ruleType,
      category: 'name' in options.subject ? options.subject.type : 'EXE',
      status: options.action,
      user: options.targetGroup,
    };
    
    return Promise.resolve(rule);
  }

  /**
   * Get policy XML preview for a phase
   */
  static getPolicyXMLPreview(phase: PolicyPhase): string {
    return `<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <!-- Policy Phase: ${phase} -->
    <FilePublisherRule Id="72277d33-..." Name="Microsoft-Signed" Action="Allow">
      <Conditions>
        <PublisherCondition PublisherName="O=Microsoft Corporation, ..." />
      </Conditions>
    </FilePublisherRule>
    ${phase.includes('Phase 2') ? '<FilePathRule Id="..." Name="Script-Allow" Action="Allow">...</FilePathRule>' : '<!-- Scripts Restricted in Phase 1 -->'}
  </RuleCollection>
</AppLockerPolicy>`;
  }
}
