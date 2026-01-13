/**
 * IPC Setup
 * Registers all IPC handlers
 */

import { setupMachineHandlers } from './handlers/machineHandlers';
import { setupPolicyHandlers } from './handlers/policyHandlers';
import { setupEventHandlers } from './handlers/eventHandlers';
import { setupADHandlers } from './handlers/adHandlers';
import { setupComplianceHandlers } from './handlers/complianceHandlers';
import { setupDialogHandlers } from './handlers/dialogHandlers';

/**
 * Setup all IPC handlers
 * Call this once when Electron app is ready
 */
export function setupIPC(): void {
  setupMachineHandlers();
  setupPolicyHandlers();
  setupEventHandlers();
  setupADHandlers();
  setupComplianceHandlers();
  setupDialogHandlers();
  console.log('IPC handlers registered');
}
