/**
 * useVirtualizedList Hook
 * Virtualizes large lists for better performance
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

interface VirtualizedListOptions<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number; // Number of items to render outside visible area
}

interface VirtualizedListResult<T> {
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  scrollToIndex: (index: number) => void;
}

export function useVirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
}: VirtualizedListOptions<T>): VirtualizedListResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    startIndex + visibleCount + overscan * 2
  );

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1);
  }, [items, startIndex, endIndex]);

  const offsetY = startIndex * itemHeight;

  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current) {
      const scrollPosition = index * itemHeight;
      containerRef.current.scrollTop = scrollPosition;
      setScrollTop(scrollPosition);
    }
  }, [itemHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll as any);
      return () => {
        container.removeEventListener('scroll', handleScroll as any);
      };
    }
  }, [handleScroll]);

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    scrollToIndex,
  };
}
