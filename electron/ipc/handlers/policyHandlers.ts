/**
 * Policy IPC Handlers
 */

import { ipcMain } from 'electron';
import { IPCChannels } from '../../../src/infrastructure/ipc/channels';
import { InventoryItem, TrustedPublisher, PolicyRule, PolicyPhase } from '../../../src/shared/types';

const { MOCK_INVENTORY, COMMON_PUBLISHERS, APPLOCKER_GROUPS } = require('../../constants.cjs');

export function setupPolicyHandlers(): void {
  ipcMain.handle(IPCChannels.POLICY.GET_INVENTORY, async (): Promise<InventoryItem[]> => {
    return MOCK_INVENTORY;
  });

  ipcMain.handle(IPCChannels.POLICY.GET_TRUSTED_PUBLISHERS, async (): Promise<TrustedPublisher[]> => {
    return COMMON_PUBLISHERS;
  });

  ipcMain.handle(IPCChannels.POLICY.GET_GROUPS, async (): Promise<string[]> => {
    return APPLOCKER_GROUPS;
  });

  ipcMain.handle(IPCChannels.POLICY.CREATE_RULE, async (_event, rule: PolicyRule): Promise<PolicyRule> => {
    console.log('Creating policy rule:', rule);
    // In production, this would commit to AD via PowerShell
    return rule;
  });

  ipcMain.handle(IPCChannels.POLICY.RUN_HEALTH_CHECK, async (_event, _phase: PolicyPhase): Promise<{ critical: number; warning: number; info: number; score: number }> => {
    // Simulated health check results
    const critical = 0;
    const warning = 2;
    const info = 4;
    const score = 100 - (20 * critical) - (5 * warning) - (1 * info);
    return { critical, warning, info, score };
  });
}
