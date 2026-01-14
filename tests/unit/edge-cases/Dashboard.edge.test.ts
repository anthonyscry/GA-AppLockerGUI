/**
 * Dashboard Edge Case Tests
 * Tests for date handling, chart data generation, and event processing
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppEvent } from '../../../src/shared/types';

// Mock the chart library
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

// Test helper to generate chart data logic (extracted from Dashboard)
function generateChartData(events: AppEvent[] | null | undefined) {
  const defaultData = [
    { name: 'Mon', allowed: 0, blocked: 0 },
    { name: 'Tue', allowed: 0, blocked: 0 },
    { name: 'Wed', allowed: 0, blocked: 0 },
    { name: 'Thu', allowed: 0, blocked: 0 },
    { name: 'Fri', allowed: 0, blocked: 0 },
  ];

  if (!events || !Array.isArray(events) || events.length === 0) {
    return defaultData;
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts: Record<string, { allowed: number; blocked: number }> = {};

  events.forEach((e: AppEvent) => {
    if (!e?.timestamp) return;
    const date = new Date(e.timestamp);
    if (isNaN(date.getTime())) {
      console.warn('[Dashboard] Invalid timestamp encountered:', e.timestamp);
      return;
    }
    const dayIndex = date.getDay();
    const dayName = days[dayIndex];
    if (!dayName) return;

    if (!dayCounts[dayName]) {
      dayCounts[dayName] = { allowed: 0, blocked: 0 };
    }
    if (e.eventId === 8004) {
      dayCounts[dayName].blocked++;
    } else {
      dayCounts[dayName].allowed++;
    }
  });

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => ({
    name: day,
    allowed: dayCounts[day]?.allowed || 0,
    blocked: dayCounts[day]?.blocked || 0,
  }));
}

describe('Dashboard Chart Data Generation Edge Cases', () => {
  describe('Invalid Input Handling', () => {
    it('should return default data for null events', () => {
      const result = generateChartData(null);

      expect(result).toHaveLength(5);
      expect(result.every(d => d.allowed === 0 && d.blocked === 0)).toBe(true);
    });

    it('should return default data for undefined events', () => {
      const result = generateChartData(undefined);

      expect(result).toHaveLength(5);
      expect(result.every(d => d.allowed === 0 && d.blocked === 0)).toBe(true);
    });

    it('should return default data for empty array', () => {
      const result = generateChartData([]);

      expect(result).toHaveLength(5);
      expect(result.every(d => d.allowed === 0 && d.blocked === 0)).toBe(true);
    });

    it('should return default data for non-array input', () => {
      const result = generateChartData('not-an-array' as any);

      expect(result).toHaveLength(5);
      expect(result.every(d => d.allowed === 0 && d.blocked === 0)).toBe(true);
    });
  });

  describe('Invalid Timestamp Handling', () => {
    it('should skip events with null timestamp', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const events = [
        { id: '1', timestamp: null, eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        { id: '2', timestamp: '2024-01-15T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as any[];

      const result = generateChartData(events);

      // Should only count the valid event (Monday Jan 15, 2024)
      const mondayData = result.find(d => d.name === 'Mon');
      expect(mondayData?.allowed).toBe(1);

      warnSpy.mockRestore();
    });

    it('should skip events with undefined timestamp', () => {
      const events = [
        { id: '1', timestamp: undefined, eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        { id: '2', timestamp: '2024-01-15T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as any[];

      const result = generateChartData(events);

      const mondayData = result.find(d => d.name === 'Mon');
      expect(mondayData?.allowed).toBe(1);
    });

    it('should skip events with invalid date string', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const events = [
        { id: '1', timestamp: 'not-a-date', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        { id: '2', timestamp: '2024-01-15T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as any[];

      const result = generateChartData(events);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid timestamp'),
        'not-a-date'
      );

      const mondayData = result.find(d => d.name === 'Mon');
      expect(mondayData?.allowed).toBe(1);

      warnSpy.mockRestore();
    });

    it('should skip events with empty string timestamp', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const events = [
        { id: '1', timestamp: '', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as any[];

      const result = generateChartData(events);

      expect(warnSpy).toHaveBeenCalled();
      expect(result.every(d => d.allowed === 0 && d.blocked === 0)).toBe(true);

      warnSpy.mockRestore();
    });

    it('should handle malformed ISO date strings', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const events = [
        { id: '1', timestamp: '2024-13-45T99:99:99Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as any[];

      const result = generateChartData(events);

      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should handle numeric timestamps (Unix epoch)', () => {
      // January 15, 2024 10:00:00 UTC - Monday
      const events = [
        { id: '1', timestamp: 1705315200000, eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as any[];

      const result = generateChartData(events);

      const mondayData = result.find(d => d.name === 'Mon');
      expect(mondayData?.allowed).toBe(1);
    });
  });

  describe('Event ID Categorization', () => {
    it('should categorize 8004 as blocked', () => {
      const events = [
        { id: '1', timestamp: '2024-01-15T10:00:00Z', eventId: 8004, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as AppEvent[];

      const result = generateChartData(events);

      const mondayData = result.find(d => d.name === 'Mon');
      expect(mondayData?.blocked).toBe(1);
      expect(mondayData?.allowed).toBe(0);
    });

    it('should categorize all other event IDs as allowed', () => {
      const events = [
        { id: '1', timestamp: '2024-01-15T10:00:00Z', eventId: 8001, path: '/test', publisher: 'Test', machine: 'PC1' },
        { id: '2', timestamp: '2024-01-15T11:00:00Z', eventId: 8002, path: '/test', publisher: 'Test', machine: 'PC1' },
        { id: '3', timestamp: '2024-01-15T12:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as AppEvent[];

      const result = generateChartData(events);

      const mondayData = result.find(d => d.name === 'Mon');
      expect(mondayData?.allowed).toBe(3);
      expect(mondayData?.blocked).toBe(0);
    });
  });

  describe('Day of Week Grouping', () => {
    it('should correctly group events by day of week', () => {
      const events = [
        // Monday
        { id: '1', timestamp: '2024-01-15T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        // Tuesday
        { id: '2', timestamp: '2024-01-16T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        // Wednesday
        { id: '3', timestamp: '2024-01-17T10:00:00Z', eventId: 8004, path: '/test', publisher: 'Test', machine: 'PC1' },
        // Thursday
        { id: '4', timestamp: '2024-01-18T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        // Friday
        { id: '5', timestamp: '2024-01-19T10:00:00Z', eventId: 8004, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as AppEvent[];

      const result = generateChartData(events);

      expect(result.find(d => d.name === 'Mon')?.allowed).toBe(1);
      expect(result.find(d => d.name === 'Tue')?.allowed).toBe(1);
      expect(result.find(d => d.name === 'Wed')?.blocked).toBe(1);
      expect(result.find(d => d.name === 'Thu')?.allowed).toBe(1);
      expect(result.find(d => d.name === 'Fri')?.blocked).toBe(1);
    });

    it('should exclude weekend events from the chart', () => {
      const events = [
        // Saturday
        { id: '1', timestamp: '2024-01-13T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        // Sunday
        { id: '2', timestamp: '2024-01-14T10:00:00Z', eventId: 8004, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as AppEvent[];

      const result = generateChartData(events);

      // Chart only shows weekdays, so all should be 0
      expect(result.every(d => d.allowed === 0 && d.blocked === 0)).toBe(true);
    });

    it('should handle events spanning multiple weeks', () => {
      const events = [
        // Week 1 Monday
        { id: '1', timestamp: '2024-01-08T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        // Week 2 Monday
        { id: '2', timestamp: '2024-01-15T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as AppEvent[];

      const result = generateChartData(events);

      // Both should be counted under Monday
      expect(result.find(d => d.name === 'Mon')?.allowed).toBe(2);
    });
  });

  describe('Malformed Event Objects', () => {
    it('should handle events missing required properties', () => {
      const events = [
        { id: '1' }, // Missing timestamp
        { timestamp: '2024-01-15T10:00:00Z' }, // Missing id
        null,
        undefined,
      ] as any[];

      expect(() => generateChartData(events)).not.toThrow();
    });

    it('should handle mixed valid and invalid events', () => {
      const events = [
        null,
        { id: '1', timestamp: '2024-01-15T10:00:00Z', eventId: 8003, path: '/test', publisher: 'Test', machine: 'PC1' },
        undefined,
        { id: '2' }, // Missing timestamp
        { id: '3', timestamp: '2024-01-16T10:00:00Z', eventId: 8004, path: '/test', publisher: 'Test', machine: 'PC1' },
      ] as any[];

      const result = generateChartData(events);

      expect(result.find(d => d.name === 'Mon')?.allowed).toBe(1);
      expect(result.find(d => d.name === 'Tue')?.blocked).toBe(1);
    });
  });
});
