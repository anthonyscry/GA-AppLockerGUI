/**
 * Policy Service
 * Business logic for policy operations
 */

import { IPolicyRepository } from '../../domain/interfaces/IPolicyRepository';
import { PolicyPhase, InventoryItem, TrustedPublisher, PolicyRule } from '../../shared/types';
import { logger } from '../../infrastructure/logging/Logger';

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

export class PolicyService {
  constructor(private readonly repository: IPolicyRepository) {}

  /**
   * Run policy health check
   */
  async runHealthCheck(phase: PolicyPhase): Promise<HealthCheckResult> {
    logger.info('Running policy health check', { phase });
    return this.repository.runHealthCheck(phase);
  }

  /**
   * Get all inventory items
   */
  async getInventory(): Promise<InventoryItem[]> {
    return this.repository.getInventory();
  }

  /**
   * Get all trusted publishers
   */
  async getTrustedPublishers(): Promise<TrustedPublisher[]> {
    return this.repository.getTrustedPublishers();
  }

  /**
   * Get available AppLocker groups
   */
  async getAppLockerGroups(): Promise<string[]> {
    return this.repository.getAppLockerGroups();
  }

  /**
   * Get unique categories from publishers
   */
  async getPublisherCategories(): Promise<string[]> {
    const publishers = await this.getTrustedPublishers();
    return ['All', ...Array.from(new Set(publishers.map(p => p.category)))];
  }

  /**
   * Generate AppLocker XML rule
   */
  generateRuleXML(options: RuleCreationOptions): string {
    const { action, ruleType, subject } = options;
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
    
    return '';
  }

  /**
   * Create a new policy rule
   */
  async createRule(options: RuleCreationOptions): Promise<PolicyRule> {
    logger.info('Creating policy rule', { action: options.action, type: options.ruleType });
    
    const rule: PolicyRule = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'name' in options.subject ? options.subject.name : options.subject.name,
      type: options.ruleType,
      category: 'name' in options.subject ? options.subject.type : 'EXE',
      status: options.action,
      user: options.targetGroup,
    };
    
    return this.repository.createRule(rule);
  }

  /**
   * Get policy XML preview for a phase
   */
  getPolicyXMLPreview(phase: PolicyPhase): string {
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
