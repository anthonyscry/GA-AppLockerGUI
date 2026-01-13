/**
 * Rule Template Types
 */

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  action: 'Allow' | 'Deny';
  ruleType: 'Publisher' | 'Path' | 'Hash';
  publisher?: string;
  path?: string;
  hash?: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
}
