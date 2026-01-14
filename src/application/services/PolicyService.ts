/**
 * Policy Service
 * Business logic for policy operations
 */

import { IPolicyRepository } from '../../domain/interfaces/IPolicyRepository';
import { PolicyPhase, InventoryItem, TrustedPublisher, PolicyRule } from '../../shared/types';
import { RuleTemplate } from '../../shared/types/template';
import { DEFAULT_TEMPLATES, TEMPLATE_CATEGORIES } from '../../infrastructure/templates/defaultTemplates';
import { logger } from '../../infrastructure/logging/Logger';

/**
 * Generate a cryptographically secure unique ID
 * Uses crypto API when available, with fallback for test environments
 */
function generateSecureId(): string {
  // Use Web Crypto API in browser/Electron renderer
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const cryptoModule = require('crypto');
      return cryptoModule.randomUUID();
    } catch {
      // Final fallback - use crypto.getRandomValues if available
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
      }
    }
  }
  // Absolute fallback (should never reach here in production)
  logger.warn('Using fallback ID generation - crypto API not available');
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escape special XML characters to prevent XML injection
 * @param input String to escape
 * @returns XML-safe string
 */
function escapeXml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate that a string is safe for use in policy rules
 * @param input String to validate
 * @returns true if string is valid
 */
function isValidRuleInput(input: string): boolean {
  if (typeof input !== 'string' || input.length === 0 || input.length > 1024) {
    return false;
  }
  // Reject strings with control characters or null bytes
  if (/[\x00-\x1f\x7f]/.test(input)) {
    return false;
  }
  return true;
}

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
   * Uses secure ID generation and XML escaping to prevent injection attacks
   */
  generateRuleXML(options: RuleCreationOptions): string {
    const { action, ruleType, subject } = options;
    // Use 'path' to distinguish InventoryItem from TrustedPublisher
    const isInventoryItem = 'path' in subject;
    const subjectName = subject.name;
    const publisherName = isInventoryItem
      ? (subject as InventoryItem).publisher
      : (subject as TrustedPublisher).publisherName;

    // Validate inputs
    if (!isValidRuleInput(subjectName)) {
      logger.error('Invalid subject name in rule generation');
      throw new Error('Invalid subject name: contains prohibited characters');
    }
    if (publisherName && !isValidRuleInput(publisherName)) {
      logger.error('Invalid publisher name in rule generation');
      throw new Error('Invalid publisher name: contains prohibited characters');
    }

    // Generate cryptographically secure ID
    const ruleId = generateSecureId();

    // Escape XML characters in rule name
    const ruleName = escapeXml(subjectName.replace(/\s/g, '-'));

    // Validate action is one of allowed values
    const validActions = ['Allow', 'Deny'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: must be one of ${validActions.join(', ')}`);
    }

    if (ruleType === 'Publisher') {
      // Escape publisher name to prevent XML injection
      const safePublisherName = escapeXml(publisherName || '');
      return `<FilePublisherRule Id="${ruleId}" Name="${ruleName}" Action="${action}">
  <Conditions>
    <PublisherCondition PublisherName="${safePublisherName}" ... />
  </Conditions>
</FilePublisherRule>`;
    }

    return '';
  }

  /**
   * Create a new policy rule
   * Uses secure ID generation and input validation
   */
  async createRule(options: RuleCreationOptions): Promise<PolicyRule> {
    logger.info('Creating policy rule', { action: options.action, type: options.ruleType });

    const ruleName = options.subject.name;

    // Validate inputs
    if (!isValidRuleInput(ruleName)) {
      throw new Error('Invalid rule name: contains prohibited characters');
    }
    if (!isValidRuleInput(options.targetGroup)) {
      throw new Error('Invalid target group: contains prohibited characters');
    }

    // Validate action is one of allowed values
    const validActions = ['Allow', 'Deny'];
    if (!validActions.includes(options.action)) {
      throw new Error(`Invalid action: must be one of ${validActions.join(', ')}`);
    }

    // Validate rule type
    const validRuleTypes = ['Publisher', 'Path', 'Hash'];
    if (!validRuleTypes.includes(options.ruleType)) {
      throw new Error(`Invalid rule type: must be one of ${validRuleTypes.join(', ')}`);
    }

    const rule: PolicyRule = {
      id: generateSecureId(),
      name: ruleName,
      type: options.ruleType,
      category: 'path' in options.subject ? (options.subject as InventoryItem).type : 'EXE',
      status: options.action,
      user: options.targetGroup,
    };

    return this.repository.createRule(rule);
  }

  /**
   * Get policy XML preview for a phase
   * Fetches real policy XML from the system via IPC
   */
  async getPolicyXMLPreview(_phase: PolicyPhase): Promise<string> {
    try {
      // Access the electron IPC bridge
      const electron = (window as unknown as { electron?: { ipc?: { invoke: (channel: string, ...args: unknown[]) => Promise<string> } } }).electron;
      if (electron?.ipc) {
        const xml = await electron.ipc.invoke('policy:getPolicyXML', 'effective');
        if (xml && xml.trim().length > 0) {
          return xml;
        }
      }
      return this.getDefaultPolicyXML();
    } catch (error) {
      logger.warn('Could not fetch policy XML from system', { error });
      return this.getDefaultPolicyXML();
    }
  }

  /**
   * Get default policy XML when actual policy is unavailable
   */
  private getDefaultPolicyXML(): string {
    return `<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="NotConfigured">
    <!-- No AppLocker policy configured on this system -->
    <!-- Use the Policy Lab to generate and deploy policies -->
  </RuleCollection>
  <RuleCollection Type="Msi" EnforcementMode="NotConfigured" />
  <RuleCollection Type="Script" EnforcementMode="NotConfigured" />
  <RuleCollection Type="Dll" EnforcementMode="NotConfigured" />
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
    // Validate items array
    if (!Array.isArray(items)) {
      logger.error('batchGenerateRules called with non-array items');
      return { success: false, error: 'Invalid input: items must be an array' };
    }
    if (items.length === 0) {
      logger.warn('batchGenerateRules called with empty items array');
      return { success: false, error: 'No items provided for rule generation' };
    }
    // Filter out invalid items
    const validItems = items.filter(item => item && typeof item === 'object' && item.name);
    if (validItems.length === 0) {
      logger.error('No valid items found in batch');
      return { success: false, error: 'No valid items found in the provided array' };
    }
    logger.info('Batch generating rules', { itemCount: validItems.length, outputPath });
    return this.repository.batchGenerateRules(validItems, outputPath, options);
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
    // Validate publishers array
    if (!Array.isArray(publishers)) {
      logger.error('batchCreatePublisherRules called with non-array publishers');
      return { success: false, error: 'Invalid input: publishers must be an array' };
    }
    if (publishers.length === 0) {
      logger.warn('batchCreatePublisherRules called with empty publishers array');
      return { success: false, error: 'No publishers provided for rule generation' };
    }
    // Filter and validate publisher strings
    const validPublishers = publishers.filter(
      p => typeof p === 'string' && p.trim().length > 0 && p.length <= 1024
    );
    if (validPublishers.length === 0) {
      logger.error('No valid publishers found in batch');
      return { success: false, error: 'No valid publisher names found in the provided array' };
    }
    logger.info('Batch creating publisher rules', { publisherCount: validPublishers.length, outputPath });
    return this.repository.batchCreatePublisherRules(validPublishers, outputPath, options);
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

    if (template.ruleType === 'Path' && template.path) {
      return this.createPathRule(template.path, outputPath, {
        name: template.name,
        action: template.action,
        targetGroup: options.targetGroup,
        collectionType: options.collectionType,
      });
    }

    return {
      success: false,
      error: `Unsupported rule type: ${template.ruleType}`,
    };
  }

  /**
   * Create a path-based rule
   */
  async createPathRule(
    rulePath: string,
    outputPath: string,
    options: {
      name?: string;
      action?: 'Allow' | 'Deny';
      targetGroup?: string;
      collectionType?: string;
    } = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    logger.info('Creating path rule', { rulePath, outputPath });

    try {
      const electron = (window as unknown as { electron?: { ipc?: { invoke: (channel: string, ...args: unknown[]) => Promise<{ success: boolean; outputPath?: string; error?: string }> } } }).electron;
      if (electron?.ipc) {
        return await electron.ipc.invoke('policy:createPathRule', {
          path: rulePath,
          name: options.name || rulePath,
          action: options.action || 'Allow',
          targetGroup: options.targetGroup,
          collectionType: options.collectionType,
        }, outputPath);
      }
      return { success: false, error: 'IPC not available' };
    } catch (error) {
      logger.error('Failed to create path rule', error as Error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
