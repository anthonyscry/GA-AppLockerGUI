/**
 * Event Repository Implementation
 */

import { IEventRepository, EventFilter } from '../../domain/interfaces/IEventRepository';
import { AppEvent } from '../../shared/types';
import { ipcClient } from '../ipc/ipcClient';
import { IPCChannels } from '../ipc/channels';
import { logger } from '../logging/Logger';
import { ExternalServiceError } from '../../domain/errors';

export class EventRepository implements IEventRepository {
  async findAll(): Promise<AppEvent[]> {
    try {
      const events = await ipcClient.invoke<AppEvent[]>(IPCChannels.EVENT.GET_ALL);
      return events || [];
    } catch (error) {
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning empty events list');
        return [];
      }
      logger.error('Failed to fetch events', error as Error);
      throw new ExternalServiceError('Event Service', 'Failed to fetch events', error as Error);
    }
  }

  async findByFilter(filter: EventFilter): Promise<AppEvent[]> {
    const all = await this.findAll();
    return this.filterEvents(all, filter);
  }

  async getStats(): Promise<{ totalBlocked: number; totalAudit: number; totalAllowed: number; uniquePaths: number }> {
    try {
      const stats = await ipcClient.invoke<{ totalBlocked: number; totalAudit: number; totalAllowed: number; uniquePaths: number }>(
        IPCChannels.EVENT.GET_STATS
      );
      return stats || { totalBlocked: 0, totalAudit: 0, totalAllowed: 0, uniquePaths: 0 };
    } catch (error) {
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning default stats');
        return { totalBlocked: 0, totalAudit: 0, totalAllowed: 0, uniquePaths: 0 };
      }
      logger.error('Failed to get event stats', error as Error);
      throw new ExternalServiceError('Event Service', 'Failed to get event stats', error as Error);
    }
  }

  async exportToCSV(events: AppEvent[]): Promise<string> {
    try {
      const csv = await ipcClient.invoke<string>(IPCChannels.EVENT.EXPORT_CSV, events);
      return csv;
    } catch (error) {
      logger.error('Failed to export CSV', error as Error);
      throw new ExternalServiceError('Event Service', 'Failed to export CSV', error as Error);
    }
  }

  private filterEvents(events: AppEvent[], filter: EventFilter): AppEvent[] {
    return events.filter(event => {
      const matchesSearch = !filter.searchQuery ||
        (event.path || '').toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        (event.machine || '').toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        (event.publisher || '').toLowerCase().includes(filter.searchQuery.toLowerCase());

      const matchesEventId = !filter.eventId || event.eventId === filter.eventId;

      const matchesMachine = !filter.machine || event.machine === filter.machine;

      const matchesDateRange = !filter.dateRange || (() => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= filter.dateRange!.start && eventDate <= filter.dateRange!.end;
      })();

      return matchesSearch && matchesEventId && matchesMachine && matchesDateRange;
    });
  }
}
