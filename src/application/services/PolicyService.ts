/**
 * Policy Service
 * Business logic for policy operations
 */

import { IPolicyRepository } from '../../domain/interfaces/IPolicyRepository';
import { PolicyPhase, InventoryItem, TrustedPublisher, PolicyRule } from '../../shared/types';
import { RuleTemplate } from '../../shared/types/template';
import { DEFAULT_TEMPLATES, TEMPLATE_CATEGORIES } from '../../infrastructure/templates/defaultTemplates';
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

  /**
   * Batch generate rules for multiple inventory items
   */
  async batchGenerateRules(
    items: InventoryItem[],
    outputPath: string,
    options: {
      ruleAction?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
      groupByPublisher?: boolean;
    } = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    logger.info('Batch generating rules', { itemCount: items.length, outputPath });
    return this.repository.batchGenerateRules(items, outputPath, options);
  }

  /**
   * Group inventory items by publisher
   */
  groupByPublisher(items: InventoryItem[]): Record<string, InventoryItem[]> {
    const groups: Record<string, InventoryItem[]> = {};
    items.forEach(item => {
      const publisher = item.publisher || 'Unknown';
      if (!groups[publisher]) {
        groups[publisher] = [];
      }
      groups[publisher].push(item);
    });
    return groups;
  }

  /**
   * Detect duplicates in inventory items
   */
  detectDuplicates(items: InventoryItem[]): {
    pathDuplicates: Array<[string, InventoryItem[]]>;
    publisherDuplicates: Array<[string, InventoryItem[]]>;
    pathDupCount: number;
    pubDupCount: number;
    totalItems: number;
  } {
    const pathDupes: Record<string, InventoryItem[]> = {};
    const publisherDupes: Record<string, InventoryItem[]> = {};
    
    items.forEach(item => {
      // Group by path
      if (item.path) {
        if (!pathDupes[item.path]) pathDupes[item.path] = [];
        pathDupes[item.path].push(item);
      }
      
      // Group by publisher + name
      const pubKey = `${item.publisher}|${item.name}`;
      if (!publisherDupes[pubKey]) publisherDupes[pubKey] = [];
      publisherDupes[pubKey].push(item);
    });
    
    const pathDuplicates = Object.entries(pathDupes).filter(([_, arr]) => arr.length > 1);
    const publisherDuplicates = Object.entries(publisherDupes).filter(([_, arr]) => arr.length > 1);
    
    return {
      pathDuplicates,
      publisherDuplicates,
      pathDupCount: pathDuplicates.length,
      pubDupCount: publisherDuplicates.length,
      totalItems: items.length,
    };
  }

  /**
   * Create publisher rule for grouped items
   */
  async createPublisherRule(
    publisher: string,
    outputPath: string,
    options: {
      action?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
    } = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    logger.info('Creating publisher rule', { publisher, outputPath });
    return this.repository.createPublisherRule(publisher, outputPath, options);
  }

  /**
   * Batch create publisher rules
   */
  async batchCreatePublisherRules(
    publishers: string[],
    outputPath: string,
    options: {
      action?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
    } = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    logger.info('Batch creating publisher rules', { publisherCount: publishers.length, outputPath });
    return this.repository.batchCreatePublisherRules(publishers, outputPath, options);
  }

  /**
   * Get all rule templates
   */
  async getRuleTemplates(): Promise<RuleTemplate[]> {
    logger.info('Fetching rule templates');
    // In production, this would fetch from repository/storage
    // For now, return default templates
    return DEFAULT_TEMPLATES;
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string): Promise<RuleTemplate[]> {
    const templates = await this.getRuleTemplates();
    if (category === 'all') return templates;
    return templates.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<RuleTemplate | null> {
    const templates = await this.getRuleTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Get template categories
   */
  async getTemplateCategories() {
    return TEMPLATE_CATEGORIES;
  }

  /**
   * Create rule from template
   */
  async createRuleFromTemplate(
    templateId: string,
    outputPath: string,
    options: {
      targetGroup?: string;
      collectionType?: string;
    } = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    logger.info('Creating rule from template', { templateId, outputPath });
    
    const template = await this.getTemplateById(templateId);
    if (!template) {
      return {
        success: false,
        error: `Template ${templateId} not found`,
      };
    }

    if (template.ruleType === 'Publisher' && template.publisher) {
      return this.repository.createPublisherRule(template.publisher, outputPath, {
        action: template.action,
        targetGroup: options.targetGroup,
        collectionType: options.collectionType,
      });
    }

    // For path rules, would need to call a different repository method
    return {
      success: false,
      error: 'Path rule creation not yet implemented',
    };
  }
}
