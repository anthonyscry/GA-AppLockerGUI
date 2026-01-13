/**
 * useFiltering Hook
 * Reusable hook for filtering operations
 */

import { useMemo, useState, useCallback } from 'react';

export interface FilterState<T> {
  searchQuery: string;
  filters: Partial<T>;
}

export interface UseFilteringOptions<T, F> {
  data: T[];
  filterFn: (item: T, filters: F) => boolean;
  initialFilters?: Partial<F>;
}

export function useFiltering<T, F extends Record<string, any>>(
  options: UseFilteringOptions<T, F>
) {
  const { data, filterFn, initialFilters = {} } = options;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Partial<F>>(initialFilters);

  const filteredData = useMemo(() => {
    return data.filter(item => filterFn(item, { ...filters, searchQuery } as F));
  }, [data, filters, searchQuery, filterFn]);

  const updateFilter = useCallback((key: keyof F, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilters(initialFilters);
  }, [initialFilters]);

  const hasActiveFilters = useMemo(() => {
    return searchQuery !== '' || 
      Object.keys(filters).some(key => {
        const value = filters[key as keyof F];
        return value !== undefined && value !== null && value !== 'All';
      });
  }, [searchQuery, filters]);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    updateFilter,
    filteredData,
    clearFilters,
    hasActiveFilters,
  };
}
