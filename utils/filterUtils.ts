/**
 * Filter Utilities
 * Common filtering helper functions
 */

/**
 * Generic string search filter
 */
export function matchesSearch(
  text: string,
  searchQuery: string,
  caseSensitive: boolean = false
): boolean {
  if (!searchQuery) return true;
  
  const source = caseSensitive ? text : text.toLowerCase();
  const search = caseSensitive ? searchQuery : searchQuery.toLowerCase();
  
  return source.includes(search);
}

/**
 * Filter array by search query on multiple fields
 */
export function filterByFields<T>(
  items: T[],
  searchQuery: string,
  fields: (keyof T)[]
): T[] {
  if (!searchQuery) return items;
  
  return items.filter(item => {
    return fields.some(field => {
      const value = item[field];
      if (value === null || value === undefined) return false;
      return matchesSearch(String(value), searchQuery);
    });
  });
}

/**
 * Filter by enum/string value with "All" option
 */
export function filterByValue<T>(
  items: T[],
  filterValue: string,
  getValue: (item: T) => string
): T[] {
  if (!filterValue || filterValue === 'All') return items;
  
  return items.filter(item => getValue(item) === filterValue);
}

/**
 * Combine multiple filters
 */
export function combineFilters<T>(
  items: T[],
  ...filters: Array<(item: T) => boolean>
): T[] {
  return items.filter(item => filters.every(filter => filter(item)));
}
