/**
 * Event Service
 * Handles AppLocker event operations
 */

import { AppEvent } from '../types';
import { MOCK_EVENTS } from '../constants';

export interface EventFilter {
  searchQuery?: string;
  eventId?: 8003 | 8004;
  machine?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface EventStats {
  totalBlocked: number;
  totalAudit: number;
  uniquePaths: number;
}

export class EventService {
  /**
   * Get all events
   */
  static async getAllEvents(): Promise<AppEvent[]> {
    // In production, this would query event logs via IPC
    return Promise.resolve([]);
  }

  /**
   * Filter events based on criteria
   */
  static filterEvents(events: AppEvent[], filter: EventFilter): AppEvent[] {
    return events.filter(event => {
      const matchesSearch = !filter.searchQuery ||
        event.path.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        event.machine.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        event.publisher.toLowerCase().includes(filter.searchQuery.toLowerCase());
      
      const matchesEventId = !filter.eventId || event.eventId === filter.eventId;
      
      const matchesMachine = !filter.machine || event.machine === filter.machine;
      
      const matchesDateRange = !filter.dateRange || (() => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= filter.dateRange!.start && eventDate <= filter.dateRange!.end;
      })();
      
      return matchesSearch && matchesEventId && matchesMachine && matchesDateRange;
    });
  }

  /**
   * Get event statistics
   */
  static async getEventStats(events?: AppEvent[]): Promise<EventStats> {
    const eventList = events || await this.getAllEvents();
    
    const totalBlocked = eventList.filter(e => e.eventId === 8004).length;
    const totalAudit = eventList.filter(e => e.eventId === 8003).length;
    const uniquePaths = new Set(eventList.map(e => e.path)).size;
    
    return {
      totalBlocked,
      totalAudit,
      uniquePaths,
    };
  }

  /**
   * Get events by machine
   */
  static async getEventsByMachine(machineName: string): Promise<AppEvent[]> {
    const events = await this.getAllEvents();
    return events.filter(e => e.machine === machineName);
  }

  /**
   * Export events to CSV
   */
  static exportToCSV(events: AppEvent[]): string {
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
  }
}
