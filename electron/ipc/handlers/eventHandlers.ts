/**
 * Event IPC Handlers
 */

import { ipcMain } from 'electron';
import { IPCChannels } from '../../../src/infrastructure/ipc/channels';
import { AppEvent } from '../../../src/shared/types';

const { MOCK_EVENTS } = require('../../constants.cjs');

export function setupEventHandlers(): void {
  ipcMain.handle(IPCChannels.EVENT.GET_ALL, async (): Promise<AppEvent[]> => {
    return MOCK_EVENTS;
  });

  ipcMain.handle(IPCChannels.EVENT.GET_STATS, async (): Promise<{ totalBlocked: number; totalAudit: number; totalAllowed: number; uniquePaths: number }> => {
    const events = MOCK_EVENTS;
    const totalBlocked = events.filter((e: AppEvent) => e.eventId === 8004).length;
    const totalAudit = events.filter((e: AppEvent) => e.eventId === 8003).length;
    const totalAllowed = events.filter((e: AppEvent) => e.eventId === 8001 || e.eventId === 8002).length;
    const uniquePaths = new Set(events.map((e: AppEvent) => e.path)).size;
    return { totalBlocked, totalAudit, totalAllowed, uniquePaths };
  });

  ipcMain.handle(IPCChannels.EVENT.EXPORT_CSV, async (_event, events: AppEvent[]): Promise<string> => {
    const headers = ['Timestamp', 'Machine', 'Path', 'Publisher', 'Event ID', 'Action'];
    const rows = events.map(e => [
      e.timestamp,
      e.machine,
      e.path,
      e.publisher,
      e.eventId.toString(),
      e.action,
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csv;
  });
}
