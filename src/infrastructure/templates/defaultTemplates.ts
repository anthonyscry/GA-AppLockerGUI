/**
 * Default Rule Templates
 * Pre-built templates for common AppLocker scenarios
 */

import { RuleTemplate } from '../../shared/types/template';

export const DEFAULT_TEMPLATES: RuleTemplate[] = [
  {
    id: 'microsoft-all',
    name: 'Allow All Microsoft-Signed Software',
    description: 'Creates Publisher rule for all Microsoft Corporation signed executables. Recommended for Phase 1 deployment.',
    action: 'Allow',
    ruleType: 'Publisher',
    publisher: 'O=MICROSOFT CORPORATION*',
    category: 'Enterprise Software',
    tags: ['microsoft', 'signed', 'common', 'phase1'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'ga-asi-internal',
    name: 'Allow All GA-ASI Internal Tools',
    description: 'Creates Publisher rule for GA-ASI signed software. Use for internal development tools.',
    action: 'Allow',
    ruleType: 'Publisher',
    publisher: 'O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.*',
    category: 'Internal Tools',
    tags: ['ga-asi', 'internal', 'signed'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'deny-unsigned-userdirs',
    name: 'Deny Unsigned Executables in User Directories',
    description: 'Denies all unsigned executables in user writable paths. Critical security rule.',
    action: 'Deny',
    ruleType: 'Path',
    path: '%USERPROFILE%\\*',
    category: 'Security',
    tags: ['security', 'deny', 'unsigned', 'user'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'allow-programfiles',
    name: 'Allow Program Files',
    description: 'Allows executables in Program Files directories. Use with caution - verify publisher signatures.',
    action: 'Allow',
    ruleType: 'Path',
    path: '%PROGRAMFILES%\\*',
    category: 'System Paths',
    tags: ['system', 'programfiles', 'common'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'allow-windows',
    name: 'Allow Windows System Files',
    description: 'Allows executables in Windows system directories. Essential for system operation.',
    action: 'Allow',
    ruleType: 'Path',
    path: '%WINDIR%\\*',
    category: 'System Paths',
    tags: ['system', 'windows', 'essential'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'deny-temp',
    name: 'Deny Executables in Temp Directories',
    description: 'Denies executables in temporary directories. Prevents execution of downloaded malware.',
    action: 'Deny',
    ruleType: 'Path',
    path: '%TEMP%\\*',
    category: 'Security',
    tags: ['security', 'deny', 'temp', 'malware'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', description: 'Show all templates' },
  { id: 'enterprise', name: 'Enterprise Software', description: 'Common enterprise applications' },
  { id: 'internal', name: 'Internal Tools', description: 'Internal development tools' },
  { id: 'security', name: 'Security Rules', description: 'Security-focused deny rules' },
  { id: 'system', name: 'System Paths', description: 'Windows system directories' },
];
