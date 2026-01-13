# Refactoring Guide

This document outlines the refactoring and modularization improvements made to the GA-AppLockerGUI codebase for easier testing and debugging.

## Overview

The codebase has been refactored to follow separation of concerns, making it more maintainable, testable, and debuggable.

## Architecture Changes

### 1. Services Layer (`/services`)

Business logic has been extracted into service classes that handle data operations independently of UI components.

#### Services Created:
- **MachineService**: Handles machine inventory and scanning operations
- **PolicyService**: Manages AppLocker policy operations and health checks
- **EventService**: Handles event filtering, statistics, and exports
- **ADService**: Manages Active Directory operations and WinRM GPO
- **ComplianceService**: Handles compliance evidence generation

#### Benefits:
- **Testability**: Services can be unit tested independently
- **Reusability**: Logic can be shared across multiple components
- **Debugging**: Business logic is isolated and easier to trace
- **Mockability**: Easy to mock for component testing

#### Usage Example:
```typescript
import { MachineService } from '../services';

// In a component
const machines = await MachineService.getAllMachines();
const filtered = MachineService.filterMachines(machines, {
  searchQuery: 'WKST',
  status: 'Online'
});
```

### 2. Custom Hooks (`/hooks`)

Reusable React hooks have been created for common patterns.

#### Hooks Created:
- **useFiltering**: Generic filtering hook with search and multiple filters
- **useDebounce**: Debounces values (useful for search inputs)
- **useModal**: Manages modal open/close state
- **useAsync**: Handles async operations with loading/error states

#### Benefits:
- **DRY**: Eliminates code duplication across components
- **Consistency**: Standardized state management patterns
- **Testability**: Hooks can be tested in isolation

#### Usage Example:
```typescript
import { useFiltering, useDebounce } from '../hooks';

const { filteredData, searchQuery, setSearchQuery, clearFilters } = useFiltering({
  data: machines,
  filterFn: (item, filters) => {
    // Custom filter logic
    return MachineService.filterMachines([item], filters).length > 0;
  }
});
```

### 3. Utility Functions (`/utils`)

Common utility functions have been extracted and organized.

#### Utility Categories:
- **filterUtils**: Generic filtering helpers
- **formatUtils**: Date, text, and path formatting
- **validationUtils**: Input validation and sanitization

#### Benefits:
- **Reusability**: Common operations in one place
- **Testability**: Pure functions are easy to test
- **Maintainability**: Single source of truth for utility logic

#### Usage Example:
```typescript
import { formatDate, truncate, isValidHostname } from '../utils';

const formatted = formatDate(new Date());
const short = truncate('Very long text', 20);
const valid = isValidHostname('WKST-QA-01');
```

### 4. Configuration Module (`/config`)

Application configuration has been centralized.

#### Configuration Includes:
- Window settings
- Service timeouts
- UI preferences
- Policy formulas
- File paths

#### Benefits:
- **Centralization**: All config in one place
- **Type Safety**: TypeScript types ensure correctness
- **Environment-Specific**: Easy to adjust for dev/prod

#### Usage Example:
```typescript
import { AppConfig } from '../config/appConfig';

const timeout = AppConfig.services.scanTimeout;
const windowWidth = AppConfig.window.defaultWidth;
```

### 5. Electron Main Process Refactoring (`/electron`)

The main Electron process has been split into modular files.

#### Modules Created:
- **windowManager.cjs**: Window creation and lifecycle
- **security.cjs**: Security handlers and certificate validation
- **appLifecycle.cjs**: App lifecycle event handlers
- **main.cjs**: Main entry point (simplified)

#### Benefits:
- **Separation of Concerns**: Each module has a single responsibility
- **Testability**: Modules can be tested independently
- **Maintainability**: Easier to understand and modify
- **Security**: Security logic is isolated and reviewable

## Testing Recommendations

### Unit Testing Services

```typescript
import { MachineService } from './services/MachineService';

describe('MachineService', () => {
  it('should filter machines by status', () => {
    const machines = [...mockMachines];
    const filtered = MachineService.filterMachines(machines, {
      status: 'Online'
    });
    expect(filtered.every(m => m.status === 'Online')).toBe(true);
  });
});
```

### Testing Custom Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useFiltering } from './hooks/useFiltering';

describe('useFiltering', () => {
  it('should filter data based on search query', () => {
    const { result } = renderHook(() =>
      useFiltering({
        data: testData,
        filterFn: (item, filters) => {
          return item.name.includes(filters.searchQuery);
        }
      })
    );
    
    act(() => {
      result.current.setSearchQuery('test');
    });
    
    expect(result.current.filteredData.length).toBeLessThan(testData.length);
  });
});
```

### Testing Utility Functions

```typescript
import { formatDate, truncate } from './utils/formatUtils';

describe('formatUtils', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15T10:30:00');
    const formatted = formatDate(date);
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
  
  it('should truncate text', () => {
    const text = 'Very long text that needs truncation';
    const truncated = truncate(text, 20);
    expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
  });
});
```

## Migration Guide

### Updating Components

#### Before:
```typescript
const filteredMachines = useMemo(() => {
  return MOCK_MACHINES.filter((machine) => {
    const matchesSearch = machine.hostname.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || machine.status === statusFilter;
    // ... more filtering logic
    return matchesSearch && matchesStatus;
  });
}, [searchQuery, statusFilter]);
```

#### After:
```typescript
import { MachineService } from '../services';
import { useFiltering } from '../hooks';

const { filteredData: filteredMachines, searchQuery, setSearchQuery } = useFiltering({
  data: machines,
  filterFn: (item, filters) => {
    return MachineService.filterMachines([item], filters).length > 0;
  },
  initialFilters: { status: 'All' }
});
```

## Benefits Summary

1. **Testing**: Business logic is separated from UI, making unit tests easier
2. **Debugging**: Clear separation makes it easier to locate and fix issues
3. **Maintainability**: Changes to logic don't require modifying UI components
4. **Reusability**: Services and hooks can be shared across components
5. **Type Safety**: TypeScript types ensure correctness across modules
6. **Scalability**: Easy to add new features without affecting existing code

## Next Steps

1. Add unit tests for services using Jest
2. Add component tests using React Testing Library
3. Set up integration tests for Electron IPC
4. Add E2E tests using Playwright or Spectron
5. Set up code coverage reporting
6. Add linting rules to enforce the new architecture
