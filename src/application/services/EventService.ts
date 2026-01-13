/**
 * Event Service
 * Business logic for event operations
 */

import { IEventRepository, EventFilter } from '../../domain/interfaces/IEventRepository';
import { AppEvent } from '../../shared/types';
import { logger } from '../../infrastructure/logging/Logger';

export interface EventStats {
  totalBlocked: number;
  totalAudit: number;
  totalAllowed: number;
  uniquePaths: number;
}

export class EventService {
  constructor(private readonly repository: IEventRepository) {}

  /**
   * Get all events
   */
  async getAllEvents(): Promise<AppEvent[]> {
    return this.repository.findAll();
  }

  /**
   * Filter events based on criteria
   */
  async filterEvents(_events: AppEvent[], filter: EventFilter): Promise<AppEvent[]> {
    return this.repository.findByFilter(filter);
  }

  /**
   * Get event statistics
   */
  async getEventStats(): Promise<EventStats> {
    return this.repository.getStats();
  }

  /**
   * Get events by machine
   */
  async getEventsByMachine(machineName: string): Promise<AppEvent[]> {
    return this.repository.findByFilter({ machine: machineName });
  }

  /**
   * Export events to CSV
   */
  async exportToCSV(events: AppEvent[]): Promise<string> {
    logger.info('Exporting events to CSV', { count: events.length });
    return this.repository.exportToCSV(events);
  }
}
