/**
 * Mock Factories
 * Factory functions for creating test data
 */

import { MachineScan } from '../../src/shared/types';
import { ADUser } from '../../src/shared/types';
import { InventoryItem, TrustedPublisher } from '../../src/shared/types';
import { AppEvent } from '../../src/shared/types';

export const createMockMachine = (overrides?: Partial<MachineScan>): MachineScan => ({
  id: 'machine-1',
  hostname: 'WKST-001',
  domain: 'GA-ASI.LOCAL',
  ouPath: 'OU=Workstations,DC=GA-ASI,DC=LOCAL',
  status: 'Online',
  riskLevel: 'Low',
  lastScanDate: new Date('2024-01-01'),
  ...overrides,
});

export const createMockADUser = (overrides?: Partial<ADUser>): ADUser => ({
  id: 'user-1',
  samAccountName: 'jdoe',
  displayName: 'John Doe',
  email: 'jdoe@ga-asi.local',
  department: 'IT',
  groups: ['Domain Users'],
  ...overrides,
});

export const createMockInventoryItem = (overrides?: Partial<InventoryItem>): InventoryItem => ({
  id: 'item-1',
  name: 'Test Application',
  publisher: 'Test Publisher',
  path: 'C:\\Program Files\\Test\\app.exe',
  version: '1.0.0',
  type: 'EXE',
  ...overrides,
});

export const createMockTrustedPublisher = (overrides?: Partial<TrustedPublisher>): TrustedPublisher => ({
  id: 'publisher-1',
  name: 'Microsoft Corporation',
  publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US',
  category: 'Software Vendor',
  description: 'Microsoft software products',
  ...overrides,
});

export const createMockAppEvent = (overrides?: Partial<AppEvent>): AppEvent => ({
  id: 'event-1',
  timestamp: new Date('2024-01-01'),
  eventId: 8003,
  level: 'Information',
  message: 'Application allowed',
  path: 'C:\\Program Files\\Test\\app.exe',
  publisher: 'Test Publisher',
  user: 'GA-ASI\\jdoe',
  computer: 'WKST-001',
  ...overrides,
});
