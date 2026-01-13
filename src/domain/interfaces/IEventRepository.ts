/**
 * Event Repository Interface
 */

import { AppEvent } from '../../shared/types';

export interface EventFilter {
  searchQuery?: string;
  eventId?: 8003 | 8004;
  machine?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface IEventRepository {
  findAll(): Promise<AppEvent[]>;
  findByFilter(filter: EventFilter): Promise<AppEvent[]>;
  getStats(): Promise<{ totalBlocked: number; totalAudit: number; uniquePaths: number }>;
  exportToCSV(events: AppEvent[]): Promise<string>;
}
