/**
 * EventService Unit Tests
 */

import { EventService } from '../../../../src/application/services/EventService';
import { IEventRepository } from '../../../../src/domain/interfaces/IEventRepository';
import { AppEvent } from '../../../../src/shared/types';
import { createMockAppEvent } from '../../../helpers/mockFactories';

describe('EventService', () => {
  let service: EventService;
  let mockRepository: jest.Mocked<IEventRepository>;

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      findByFilter: jest.fn(),
      getStats: jest.fn(),
      exportToCSV: jest.fn(),
    } as any;

    service = new EventService(mockRepository);
  });

  describe('getAllEvents', () => {
    it('should return all events', async () => {
      const mockEvents: AppEvent[] = [
        createMockAppEvent({ id: '1' }),
        createMockAppEvent({ id: '2' }),
      ];

      mockRepository.findAll.mockResolvedValue(mockEvents);

      const result = await service.getAllEvents();

      expect(result).toEqual(mockEvents);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('filterEvents', () => {
    it('should filter events by criteria', async () => {
      const mockEvents: AppEvent[] = [
        createMockAppEvent({ eventId: 8003 }),
        createMockAppEvent({ eventId: 8004 }),
      ];

      mockRepository.findByFilter.mockResolvedValue([mockEvents[0]]);

      const result = await service.filterEvents(mockEvents, {
        eventId: 8003,
      });

      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe(8003);
    });
  });

  describe('getEventStats', () => {
    it('should return event statistics', async () => {
      const mockStats = {
        totalBlocked: 5,
        totalAudit: 95,
        uniquePaths: 50,
      };

      mockRepository.getStats.mockResolvedValue(mockStats);

      const result = await service.getEventStats();

      expect(result).toEqual(mockStats);
      expect(mockRepository.getStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportToCSV', () => {
    it('should export events to CSV', async () => {
      const mockCSV = 'EventId,Timestamp,Path\n8003,2024-01-01,C:\\test.exe';
      mockRepository.exportToCSV.mockResolvedValue(mockCSV);

      const events = [createMockAppEvent()];
      const result = await service.exportToCSV(events);

      expect(result).toBe(mockCSV);
      expect(mockRepository.exportToCSV).toHaveBeenCalledWith(events);
    });
  });
});
