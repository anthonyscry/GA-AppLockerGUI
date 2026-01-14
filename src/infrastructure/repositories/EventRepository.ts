/**
 * Event Repository Implementation
 *
 * Handles retrieval and filtering of AppLocker audit events (8001-8004).
 * Events are fetched from Windows Event Viewer via PowerShell IPC calls.
 *
 * Event ID Reference:
 * - 8001: AppLocker policy applied successfully
 * - 8002: Application allowed (matched allow rule)
 * - 8003: Application would have been blocked (audit mode warning)
 * - 8004: Application blocked (enforcement mode)
 *
 * LESSON LEARNED: IPC handlers may return error objects instead of data arrays.
 * Common errors include:
 * - "AppLocker event log not found" - AppLocker not configured on system
 * - "Access denied" - Insufficient permissions to read event logs
 * Always check for error responses before treating result as valid data.
 *
 * See docs/LESSONS_LEARNED.md for full documentation.
 *
 * @module EventRepository
 */

import { IEventRepository, EventFilter } from '../../domain/interfaces/IEventRepository';
import { AppEvent } from '../../shared/types';
import { ipcClient } from '../ipc/ipcClient';
import { IPCChannels } from '../ipc/channels';
import { logger } from '../logging/Logger';
import { ExternalServiceError } from '../../domain/errors';

export class EventRepository implements IEventRepository {
  /**
   * Retrieve all AppLocker events from Windows Event Viewer
   * Fetches from "Microsoft-Windows-AppLocker/EXE and DLL" log
   *
   * @returns Promise<AppEvent[]> Array of AppLocker events
   * @throws ExternalServiceError if IPC call fails (except in browser mode)
   */
  async findAll(): Promise<AppEvent[]> {
    try {
      const result = await ipcClient.invoke<AppEvent[] | { error: string; errorType?: string }>(IPCChannels.EVENT.GET_ALL);

      // Check if the result is an error response from PowerShell
      if (result && typeof result === 'object' && 'error' in result) {
        const errorMsg = (result as { error: string }).error;
        const errorType = (result as { errorType?: string }).errorType || 'Unknown';
        logger.error(`AppLocker event query failed: ${errorMsg} (${errorType})`);
        throw new ExternalServiceError('AppLocker Events', errorMsg, new Error(errorMsg));
      }

      const events = result as AppEvent[];
      return events || [];
    } catch (error) {
      // Gracefully handle browser mode (no Electron IPC available)
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning empty events list');
        return [];
      }
      // Re-throw ExternalServiceError as-is
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      logger.error('Failed to fetch events', error as Error);
      throw new ExternalServiceError('Event Service', 'Failed to fetch events', error as Error);
    }
  }

  /**
   * Retrieve events matching specified filter criteria
   * Fetches all events then applies client-side filtering
   *
   * @param filter - EventFilter object with search/filter criteria
   * @returns Promise<AppEvent[]> Filtered array of events
   */
  async findByFilter(filter: EventFilter): Promise<AppEvent[]> {
    const all = await this.findAll();
    return this.filterEvents(all, filter);
  }

  /**
   * Get aggregate statistics for AppLocker events
   * Used for dashboard summary cards
   *
   * @returns Promise with counts for blocked, audit, allowed events and unique paths
   */
  async getStats(): Promise<{ totalBlocked: number; totalAudit: number; totalAllowed: number; uniquePaths: number }> {
    try {
      const stats = await ipcClient.invoke<{
        totalBlocked?: number;
        totalAudit?: number;
        totalAllowed?: number;
        uniquePaths?: number;
        totalWarnings?: number;
      }>(IPCChannels.EVENT.GET_STATS);
      return {
        totalBlocked: stats?.totalBlocked ?? 0,
        totalAudit: stats?.totalAudit ?? stats?.totalWarnings ?? 0,
        totalAllowed: stats?.totalAllowed ?? 0,
        uniquePaths: stats?.uniquePaths ?? 0,
      };
    } catch (error) {
      // Gracefully handle browser mode
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning default stats');
        return { totalBlocked: 0, totalAudit: 0, totalAllowed: 0, uniquePaths: 0 };
      }
      logger.error('Failed to get event stats', error as Error);
      throw new ExternalServiceError('Event Service', 'Failed to get event stats', error as Error);
    }
  }

  /**
   * Export events to CSV format for external analysis
   *
   * @param events - Array of events to export
   * @returns Promise<string> CSV-formatted string
   */
  async exportToCSV(events: AppEvent[]): Promise<string> {
    try {
      const csv = await ipcClient.invoke<string>(IPCChannels.EVENT.EXPORT_CSV, events);
      return csv;
    } catch (error) {
      logger.error('Failed to export CSV', error as Error);
      throw new ExternalServiceError('Event Service', 'Failed to export CSV', error as Error);
    }
  }

  /**
   * Client-side filtering of events based on filter criteria
   *
   * Handles null/undefined properties safely to prevent crashes when
   * event data is incomplete (e.g., path or publisher not parsed from message).
   *
   * @param events - Array of events to filter
   * @param filter - Filter criteria (search query, event ID, machine, date range)
   * @returns Filtered array of events matching all criteria
   *
   * @private
   */
  private filterEvents(events: AppEvent[], filter: EventFilter): AppEvent[] {
    return events.filter(event => {
      // Search across path, machine, and publisher fields
      // Use empty string fallback to handle null/undefined properties safely
      const matchesSearch = !filter.searchQuery ||
        (event.path || '').toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        (event.machine || '').toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        (event.publisher || '').toLowerCase().includes(filter.searchQuery.toLowerCase());

      // Filter by specific event ID (8001-8004)
      const matchesEventId = !filter.eventId || event.eventId === filter.eventId;

      // Filter by machine/computer name
      const matchesMachine = !filter.machine || event.machine === filter.machine;

      // Filter by date range (inclusive)
      const matchesDateRange = !filter.dateRange || (() => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= filter.dateRange!.start && eventDate <= filter.dateRange!.end;
      })();

      // Event must match ALL specified criteria (AND logic)
      return matchesSearch && matchesEventId && matchesMachine && matchesDateRange;
    });
  }
}
